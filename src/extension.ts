// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	//console.log('Congratulations, your extension "fpga-ai-verification-tool" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	const disposable = vscode.commands.registerCommand(
	'fpga-ai-verification-tool.analyzeFile',
	async () => {

		const editor = vscode.window.activeTextEditor;

		if (!editor) {
			vscode.window.showErrorMessage("No active file.");
			return;
		}

		const document = editor.document;
		const text = document.getText();

		const isHDL =
			document.fileName.endsWith(".v") ||
			document.fileName.endsWith(".sv") ||
			document.fileName.endsWith(".vhd");

		if (!isHDL) {
			vscode.window.showWarningMessage(
				"Open a Verilog, SystemVerilog, or VHDL file."
			);
			return;
		}

		vscode.window.showInformationMessage(
			`FPGA file loaded: ${document.fileName} (${text.length} chars)`
		);
	}
);

	context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}
