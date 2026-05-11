import * as vscode from 'vscode';
import { VerificationProvider } from './VerificationProvider';
import { isHDLFile, runChecks } from './checker';
import { findHDLFiles } from './utils/fileScanner';
import { VerificationResult } from './checker';

export function activate(context: vscode.ExtensionContext) {
	const verificationProvider = new VerificationProvider();

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
	(result: VerificationResult) => {
		const panel = vscode.window.createWebviewPanel(
			'fpgaReport',
			`${result.fileName.split(/[\\/]/).pop()} Report`,
			vscode.ViewColumn.Beside,
			{
				enableScripts: true
			}
		);

		panel.webview.html = getReportWebview(result);
	}
);

	context.subscriptions.push(
		analyzeFileCommand,
		analyzeWorkspaceCommand,
		openReportCommand
	);

}
	

function getReportWebview(result: VerificationResult): string {
	const fileName =
		result.fileName.split(/[\\/]/).pop() || result.fileName;

	const criticalHTML =
		result.criticalErrors.length > 0
			? result.criticalErrors
					.map(
						error =>
							`<li class="critical">${error}</li>`
					)
					.join('')
			: '<li>No critical errors.</li>';

	const warningHTML =
		result.warnings.length > 0
			? result.warnings
					.map(
						warning =>
							`<li class="warning">${warning}</li>`
					)
					.join('')
			: '<li>No warnings.</li>';

	return `
	<!DOCTYPE html>
	<html lang="en">
	<head>
		<meta charset="UTF-8">

		<style>
			body {
				font-family: sans-serif;
				padding: 20px;
				background-color: #1e1e1e;
				color: white;
			}

			h1 {
				color: #00ffd0;
			}

			h2 {
				margin-top: 30px;
			}

			.card {
				background: #252526;
				padding: 16px;
				border-radius: 10px;
				margin-bottom: 20px;
			}

			.warning {
				color: #ffcc00;
				margin-bottom: 8px;
			}

			.critical {
				color: #ff5555;
				margin-bottom: 8px;
			}

			.summary {
				font-size: 18px;
				margin-bottom: 20px;
			}
		</style>
	</head>

	<body>
		<h1>${fileName}</h1>

		<div class="summary">
			❌ ${result.criticalErrors.length} Critical Errors
			&nbsp;&nbsp;&nbsp;
			⚠ ${result.warnings.length} Warnings
		</div>

		<div class="card">
			<h2>Critical Errors</h2>
			<ul>
				${criticalHTML}
			</ul>
		</div>

		<div class="card">
			<h2>Warnings</h2>
			<ul>
				${warningHTML}
			</ul>
		</div>

		<div class="card">
			<h2>Future Features</h2>
			<ul>
				<li>AI explanations</li>
				<li>Generate testbench</li>
				<li>FSM detection</li>
				<li>Clock domain analysis</li>
			</ul>
		</div>
	</body>
	</html>
	`;
}

export function deactivate() {}