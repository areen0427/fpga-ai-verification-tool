import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { spawn } from "child_process";

export interface SynthesisResult {
	passed: boolean;
	log: string;
	errors: string[];
	netlistPath?: string;
	jsonPath?: string;
	svgPath?: string;
	svgText?: string;
}

function runCommand(
	command: string,
	args: string[],
	cwd: string
): Promise<{ code: number | null; stdout: string; stderr: string }> {
	return new Promise(resolve => {
		const child = spawn(command, args, { cwd });

		let stdout = "";
		let stderr = "";

		child.stdout.on("data", data => {
			stdout += data.toString();
		});

		child.stderr.on("data", data => {
			stderr += data.toString();
		});

		child.on("close", code => {
			resolve({ code, stdout, stderr });
		});

		child.on("error", err => {
			resolve({
				code: -1,
				stdout,
				stderr: err.message
			});
		});
	});
}

export async function runYosysSynthesis(
	designFile: string
): Promise<SynthesisResult> {
	const workspace = vscode.workspace.workspaceFolders?.[0];

	if (!workspace) {
		return {
			passed: false,
			log: "No workspace folder is open.",
			errors: ["No workspace folder is open."]
		};
	}

	const workspacePath = workspace.uri.fsPath;

	const synthDir = path.join(workspacePath, ".fpga-synth");
	const netlistPath = path.join(synthDir, "synth_netlist.v");
	const jsonPath = path.join(synthDir, "synth.json");
	const svgPath = path.join(synthDir, "synth.svg");

	if (!fs.existsSync(synthDir)) {
		fs.mkdirSync(synthDir);
	}

	const yosysScript = `
read_verilog "${designFile}"
hierarchy -auto-top
proc
opt
fsm
opt
memory
opt
techmap
opt
write_json "${jsonPath}"
write_verilog "${netlistPath}"
`;

	const scriptPath = path.join(synthDir, "synth.ys");
	fs.writeFileSync(scriptPath, yosysScript);

	const yosysResult = await runCommand("yosys", ["-s", scriptPath], workspacePath);

	const fullLog = yosysResult.stdout + "\n" + yosysResult.stderr;

	if (yosysResult.code !== 0) {
		return {
			passed: false,
			log: fullLog,
			errors: [yosysResult.stderr || "Yosys synthesis failed."]
		};
	}

	const svgResult = await runCommand(
		"netlistsvg",
		[jsonPath, "-o", svgPath],
		workspacePath
	);

	const svgLog = svgResult.stdout + "\n" + svgResult.stderr;
	const combinedLog = fullLog + "\n\n--- NetlistSVG ---\n" + svgLog;

	if (svgResult.code !== 0) {
		return {
			passed: false,
			log: combinedLog,
			errors: [svgResult.stderr || "NetlistSVG diagram generation failed."],
			netlistPath,
			jsonPath
		};
	}

	const svgText = fs.existsSync(svgPath)
		? fs.readFileSync(svgPath, "utf8")
		: "";

	return {
		passed: true,
		log: combinedLog,
		errors: [],
		netlistPath,
		jsonPath,
		svgPath,
		svgText
	};
}