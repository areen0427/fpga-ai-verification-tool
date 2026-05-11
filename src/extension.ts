import * as vscode from 'vscode';
import { VerificationProvider } from './VerificationProvider';
import { isHDLFile, runChecks } from './checker';
import { findHDLFiles } from './utils/fileScanner';

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

	context.subscriptions.push(analyzeFileCommand, analyzeWorkspaceCommand);
}

export function deactivate() {}