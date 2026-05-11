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
], workspacePath);

	fullLog += "=== IVERILOG COMPILE ===\n";
	fullLog += compileResult.output + "\n";

	if (compileResult.code !== 0) {
		return parseSimulationOutput(compileResult.code, null, fullLog);
	}

	const simResult = await runCommand("vvp", [simOutPath], workspacePath);

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
	cwd: string
): Promise<{ code: number | null; output: string }> {
	return new Promise(resolve => {
		const child = spawn(command, args, { cwd });

		let output = "";

		child.stdout.on("data", data => {
			output += data.toString();
		});

		child.stderr.on("data", data => {
			output += data.toString();
		});

		child.on("error", error => {
			resolve({
				code: 1,
				output:
					`${error.message}\n\n` +
					`Make sure Icarus Verilog is installed and available in PATH.`
			});
		});

		child.on("close", code => {
			resolve({ code, output });
		});
	});
}