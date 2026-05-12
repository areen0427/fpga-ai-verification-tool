import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { spawn } from "child_process";
import { parseSimulationOutput, ParsedSimulationResult } from "./simulationParser";

export async function runIverilogSimulation(
	testbench: string,
	designFile: string
): Promise<ParsedSimulationResult> {
	const workspace = vscode.workspace.workspaceFolders?.[0];

	if (!workspace) {
		return {
			compilePassed: false,
			simulationPassed: false,
			errors: ["No workspace folder is open."],
			warnings: [],
			rawLog: "No workspace folder is open.",
			canAddToProject: false
		};
	}

	const workspacePath = workspace.uri.fsPath;
	const tbPath = path.join(workspacePath, "generated_tb_temp.v");
	const simOutPath = path.join(workspacePath, "generated_tb_temp.out");

	fs.writeFileSync(tbPath, testbench);

	if (!fs.existsSync(designFile)) {
	return {
		compilePassed: false,
		simulationPassed: false,
		errors: [`Design file not found: ${designFile}`],
		warnings: [],
		rawLog: `Design file not found: ${designFile}`,
		canAddToProject: false
	};
}

	let fullLog = "";

	const compileResult = await runCommand("iverilog", [
	"-Wall",
	"-g2012",
	"-o",
	simOutPath,
	tbPath,
	designFile
], workspacePath, 10000);

	fullLog += "=== IVERILOG COMPILE ===\n";
	fullLog += compileResult.output + "\n";

	if (compileResult.code !== 0) {
		return parseSimulationOutput(compileResult.code, null, fullLog);
	}

	const simResult = await runCommand("vvp", [simOutPath], workspacePath, 10000);

	fullLog += "\n=== VVP SIMULATION ===\n";
	fullLog += simResult.output + "\n";

	try {
	if (fs.existsSync(tbPath)) {
		fs.unlinkSync(tbPath);
	}

	if (fs.existsSync(simOutPath)) {
		fs.unlinkSync(simOutPath);
	}
	}
	catch (cleanupError) {
		console.error("Failed to clean temp simulation files:", cleanupError);
	}

	return parseSimulationOutput(
		compileResult.code,
		simResult.code,
		fullLog
	);
}

function runCommand(
	command: string,
	args: string[],
	cwd: string,
	timeoutMs = 10000
): Promise<{ code: number | null; output: string; timedOut: boolean }> {
	return new Promise(resolve => {
		const child = spawn(command, args, { cwd });

		let output = "";
		let finished = false;

		const timeout = setTimeout(() => {
			if (finished) {
				return;
			}

			finished = true;
			child.kill();

			resolve({
				code: null,
				output:
					output +
					`\n\n${command} timed out after ${timeoutMs / 1000} seconds. ` +
					`The generated testbench may be missing $finish or stuck in an infinite loop.`,
				timedOut: true
			});
		}, timeoutMs);

		child.stdout.on("data", data => {
			output += data.toString();
		});

		child.stderr.on("data", data => {
			output += data.toString();
		});

		child.on("error", error => {
			if (finished) {
				return;
			}

			finished = true;
			clearTimeout(timeout);

			resolve({
				code: 1,
				output:
					`${error.message}\n\n` +
					`Make sure Icarus Verilog is installed and available in PATH.`,
				timedOut: false
			});
		});

		child.on("close", code => {
			if (finished) {
				return;
			}

			finished = true;
			clearTimeout(timeout);

			resolve({
				code,
				output,
				timedOut: false
			});
		});
	});
}