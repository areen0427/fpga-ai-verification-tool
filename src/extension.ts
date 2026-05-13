import * as vscode from 'vscode';
import { VerificationProvider } from './VerificationProvider';
import { isHDLFile, runChecks } from './checker';
import { findHDLFiles } from './utils/fileScanner';
import { VerificationResult } from './checker';
import { runIverilogSimulation } from "./simulator/iverilogRunner";
import { getReportWebview } from "./reportWebview";
import {
	generateOllamaTestbench,
	TestbenchSettings,
	cleanGeneratedCode
} from "./gentb";
import { runYosysSynthesis } from "./synthesisRunner";


	type PreAnalysisResult = {
	summary: string;
	moduleName?: string;
	isSequential: boolean;
	hasClock: boolean;
	hasReset: boolean;
	outputCount: number;
};

function preAnalyzeVerilog(text: string): PreAnalysisResult {

	const moduleMatch =
		text.match(/\bmodule\s+([a-zA-Z_][a-zA-Z0-9_$]*)/);

	const moduleName = moduleMatch?.[1];

	const hasClock =
		/\b(clk|clock)\b/i.test(text);

	const hasReset =
		/\b(rst|reset|rst_n|reset_n)\b/i.test(text);

	const isSequential =
		/always\s*@\s*\([^)]*posedge|always\s*@\s*\([^)]*negedge|always_ff/i
			.test(text);

	const outputMatches =
		text.match(/\boutput\b/g);

	const outputCount =
		outputMatches ? outputMatches.length : 0;

	let summary =
		"Combinational logic detected.";

	if (isSequential && hasClock && hasReset) {
		summary =
			"Sequential design with clock/reset detected.";
	}
	else if (isSequential && hasClock) {
		summary =
			"Clocked sequential logic detected.";
	}

	if (/fsm|state|case\s*\(/i.test(text)) {
		summary =
			"FSM-style sequential design detected.";
	}

	return {
		summary,
		moduleName,
		isSequential,
		hasClock,
		hasReset,
		outputCount
	};
}

export function activate(context: vscode.ExtensionContext) {
	const verificationProvider = new VerificationProvider();

	let canAddGeneratedTbToProject = false;

	let testbenchSettings: TestbenchSettings = {
		testbenchDepth: "standard",
		customCaseCount: 20,
		includeEdgeCases: true,
		includeInvalidInputs: true,
		includeRandomTests: false,
		includeAssertions: true,
		includeSelfChecking: true,
		includeWaveDump: true,
		includeComments: true,
		customPrompt: ""
	};

	vscode.window.registerTreeDataProvider(
		'fpgaVerifierResults',
		verificationProvider
	);

	const analyzeFileCommand = vscode.commands.registerCommand(
		'fpga-ai-verification-tool.analyzeFile',
		async () => {
			const editor = vscode.window.activeTextEditor;

			if (!editor) {
				vscode.window.showErrorMessage("No active file.");
				return;
			}

			const document = editor.document;

			if (!isHDLFile(document.fileName)) {
				vscode.window.showWarningMessage(
					"Open a Verilog, SystemVerilog, or VHDL file."
				);
				return;
			}

			const result = runChecks(document.getText(), document.fileName);

			verificationProvider.updateResults([
				result
			]);

			const criticalCount = result.criticalErrors.length;
			const warningCount = result.warnings.length;

			if (criticalCount > 0) {
				vscode.window.showErrorMessage(
					`Found ${criticalCount} critical error(s).`
				);
			} else if (warningCount > 0) {
				vscode.window.showWarningMessage(
					`Found ${warningCount} warning(s).`
				);
			} else {
				vscode.window.showInformationMessage(
					"No HDL issues found."
				);
			}
		}
	);

	const analyzeWorkspaceCommand = vscode.commands.registerCommand(
		'fpga-ai-verification-tool.analyzeWorkspace',
		async () => {
			const files = await findHDLFiles();

			if (files.length === 0) {
				vscode.window.showInformationMessage(
					"No Verilog, SystemVerilog, or VHDL files found in this workspace."
				);
				return;
			}

			const results = [];

			for (const file of files) {
				const document = await vscode.workspace.openTextDocument(file);
				const result = runChecks(document.getText(), document.fileName);
				results.push(result);
			}

			verificationProvider.updateResults(results);

			const totalCritical = results.reduce(
				(sum, result) => sum + result.criticalErrors.length,
				0
			);

			const totalWarnings = results.reduce(
				(sum, result) => sum + result.warnings.length,
				0
			);

			vscode.window.showInformationMessage(
				`Checked ${files.length} HDL file(s): ${totalCritical} critical error(s), ${totalWarnings} warning(s).`
			);
		}
	);

	const openReportCommand = vscode.commands.registerCommand(
	'fpga-ai-verification-tool.openReport',
	async (result: VerificationResult) => {
		const panel = vscode.window.createWebviewPanel(
			'fpgaReport',
			`${result.fileName.split(/[\\/]/).pop()} Report`,
			vscode.ViewColumn.Beside,
			{
				enableScripts: true,
				retainContextWhenHidden: true
			}
		);

		const document =
		await vscode.workspace.openTextDocument(
			result.fileName
		);

		const preAnalysis =
		preAnalyzeVerilog(document.getText());

		panel.webview.html =
		getReportWebview(
			result,
			preAnalysis
		);

		panel.webview.onDidReceiveMessage(async (message) => {

			if (message.command === "generateHardware") {

				const synthResult = await runYosysSynthesis(result.fileName);

				panel.webview.postMessage({
					command: "showSynthesisResult",
					result: synthResult
				});
			}


			switch (message.command) {

				case "updateTestbenchSettings": {
					testbenchSettings = {
						...testbenchSettings,
						...message.settings
					};

					break;
				}

				case "generateTestbench": {
					let fullTestbench = "";

					canAddGeneratedTbToProject = false;

					try {
						panel.webview.postMessage({
							command: "startGeneratedTestbench"
						});

						await generateOllamaTestbench(
							result.fileName,
							testbenchSettings,
							async (chunk: string) => {
							fullTestbench += chunk;

							panel.webview.postMessage({
								command: "appendGeneratedTestbench",
								chunk
							}
							);
						});

						fullTestbench = cleanGeneratedCode(fullTestbench);

						panel.webview.postMessage({
							command: "showFinalGeneratedTestbench",
							testbenchText: fullTestbench
						});

						panel.webview.postMessage({
							command: "finishGeneratedTestbench"
						});
					} catch (error: any) {
						panel.webview.postMessage({
							command: "showFinalGeneratedTestbench",
							testbenchText:
								"Generation failed.\n\n" +
								(error?.message || String(error))
						});

						vscode.window.showErrorMessage(
							`Testbench generation failed: ${error?.message || String(error)}`
						);
					}

					break;
				}

				case "verifyGeneratedTestbench": {
					try {
						const simResult = await runIverilogSimulation(
							message.testbench,
							result.fileName
						);

						canAddGeneratedTbToProject =
							simResult.canAddToProject;

						panel.webview.postMessage({
							command: "simulationResults",
							results: simResult
						});
					} catch (error: any) {
						canAddGeneratedTbToProject = false;

						panel.webview.postMessage({
							command: "simulationResults",
							results: {
								compilePassed: false,
								simulationPassed: false,
								errors: [error?.message || String(error)],
								warnings: [],
								rawLog: error?.message || String(error),
								canAddToProject: false
							}
						});
					}

					break;
				}

				case "addTestbenchToProject": {
					if (!canAddGeneratedTbToProject) {
						vscode.window.showErrorMessage(
							"Cannot add testbench to project because compile/simulation errors were found."
						);
						return;
					}

					const tbPath = result.fileName.replace(
						/\.(v|sv)$/,
						"_tb.v"
					);

					const tbUri = vscode.Uri.file(tbPath);

					await vscode.workspace.fs.writeFile(
						tbUri,
						Buffer.from(message.testbenchText, "utf8")
					);

					const doc =
						await vscode.workspace.openTextDocument(tbUri);

					await vscode.window.showTextDocument(doc);

					vscode.window.showInformationMessage(
						"Testbench added to project."
					);

					break;
				}

				case "explainSynthesisFailure": {
					const prompt = `
				Explain this Yosys synthesis failure in simple FPGA beginner-friendly terms.

				Focus on:
				- What likely failed
				- What file/code issue may have caused it
				- What the user should check next

				Errors:
				${message.errors?.join("\n") || "No explicit errors"}

				Full synthesis log:
				${message.log}
				`;

					let explanation = "";

					try {
						await generateOllamaTestbench(
							result.fileName,
							{
								...testbenchSettings,
								customPrompt: prompt
							},
							async (chunk: string) => {
								explanation += chunk;
							}
						);

						explanation = cleanGeneratedCode(explanation);
					} catch (error: any) {
						explanation =
							"AI explanation failed, but synthesis did fail. Check the Yosys log for syntax errors, unsupported Verilog, missing modules, or invalid file paths.";
					}

					panel.webview.postMessage({
						command: "synthesisFailureExplanation",
						explanation
					});

					break;
				}
			}
		});
	}
);

	context.subscriptions.push(
		analyzeFileCommand,
		analyzeWorkspaceCommand,
		openReportCommand
	);

}

export function deactivate() {}