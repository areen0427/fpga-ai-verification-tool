import * as vscode from 'vscode';
import { VerificationProvider } from './VerificationProvider';
import { isHDLFile, runChecks } from './checker';
import { findHDLFiles } from './utils/fileScanner';
import { VerificationResult } from './checker';
import { generateOllamaTestbench } from "./gentb";
import { runIverilogSimulation } from "./simulator/iverilogRunner";
import { getReportWebview } from "./reportWebview";

export function activate(context: vscode.ExtensionContext) {
	const verificationProvider = new VerificationProvider();

	let canAddGeneratedTbToProject = false;

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

		panel.webview.html = getReportWebview(result);

		panel.webview.onDidReceiveMessage(async (message) => {
			switch (message.command) {
				case "generateTestbench": {
					let fullTestbench = "";

					canAddGeneratedTbToProject = false;

					try {
						panel.webview.postMessage({
							command: "startGeneratedTestbench"
						});

						await generateOllamaTestbench(result.fileName, async (chunk: string) => {
							fullTestbench += chunk;

							panel.webview.postMessage({
								command: "appendGeneratedTestbench",
								chunk
							});
						});

						fullTestbench = fullTestbench
							.replace(/^```(?:verilog|systemverilog|sv)?\s*/i, "")
							.replace(/\s*```\s*$/i, "")
							.trim();

						fullTestbench = fullTestbench.replace(
							/^timescale\b/i,
							"`timescale"
						);

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