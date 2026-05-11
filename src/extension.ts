import * as vscode from 'vscode';
import { VerificationProvider } from './VerificationProvider';
import { isHDLFile, runChecks } from './checker';
import { findHDLFiles } from './utils/fileScanner';
import { VerificationResult } from './checker';
import { generateOllamaTestbench } from "./gentb";

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
	async (result: VerificationResult) => {
		const panel = vscode.window.createWebviewPanel(
			'fpgaReport',
			`${result.fileName.split(/[\\/]/).pop()} Report`,
			vscode.ViewColumn.Beside,
			{
				enableScripts: true
			}
		);

		panel.webview.html = getReportWebview(result);

		panel.webview.onDidReceiveMessage(async (message) => {
	switch (message.command) {
		case "generateTestbench": {
	let fullTestbench = "";

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
		.replace(/```verilog/g, "")
		.replace(/```systemverilog/g, "")
		.replace(/```sv/g, "")
		.replace(/```/g, "")
		.trim();

	panel.webview.postMessage({
		command: "showFinalGeneratedTestbench",
		testbenchText: fullTestbench
	});

	panel.webview.postMessage({
		command: "finishGeneratedTestbench"
	});

	break;
}

		case "addTestbenchToProject": {
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
	

function getReportWebview(result: VerificationResult): string {
	const fileName =
		result.fileName.split(/[\\/]/).pop() || result.fileName;

	const criticalHTML =
		result.criticalErrors.length > 0
			? result.criticalErrors
					.map(error => `<li>${error}</li>`)
					.join('')
			: '<li>No critical errors found.</li>';

	const warningHTML =
		result.warnings.length > 0
			? result.warnings
					.map(warning => `<li>${warning}</li>`)
					.join('')
			: '<li>No warnings found.</li>';

	return `
	<!DOCTYPE html>
	<html lang="en">
	<head>
		<meta charset="UTF-8">

		<style>
			* {
				box-sizing: border-box;
			}

			body {
				margin: 0;
				padding: 28px;
				font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
				background: #181818;
				color: #f3f3f3;
			}

			.page {
				max-width: 1100px;
				margin: 0 auto;
			}

			.header {
				margin-bottom: 24px;
			}

			.file-name {
				font-size: 36px;
				font-weight: 800;
				color: #19f5d0;
				margin-bottom: 12px;
			}

			.summary {
				display: flex;
				gap: 14px;
				flex-wrap: wrap;
			}

			.badge {
				display: inline-flex;
				align-items: center;
				gap: 8px;
				padding: 8px 12px;
				border-radius: 999px;
				background: #262626;
				border: 1px solid #3a3a3a;
				font-size: 14px;
				font-weight: 600;
			}

			.badge.critical {
				color: #ff5c5c;
				border-color: rgba(255, 92, 92, 0.35);
			}

			.badge.warning {
				color: #ffd84d;
				border-color: rgba(255, 216, 77, 0.35);
			}

			.card {
				background: #222222;
				border: 1px solid #333333;
				border-radius: 16px;
				padding: 22px;
				margin-bottom: 22px;
				box-shadow: 0 10px 30px rgba(0, 0, 0, 0.22);
			}

			.card-header {
				display: flex;
				align-items: center;
				justify-content: space-between;
				gap: 16px;
				margin-bottom: 8px;
			}

			.top-actions {
				display: flex;
				align-items: center;
				gap: 10px;
			}

			.clear-btn {
				height: 38px;
				padding: 0 14px;
				border-radius: 10px;
				background: #3a1f1f;
				color: #ff5c5c;
				border: 1px solid rgba(255, 92, 92, 0.45);
				font-size: 13px;
				font-weight: 700;
				line-height: 1;
				display: flex;
				align-items: center;
				justify-content: center;
			}

			.clear-btn:hover {
				background: #552525;
			}

			h2 {
				margin: 0;
				font-size: 22px;
				font-weight: 750;
			}

			p {
				margin: 0;
				color: #bdbdbd;
				line-height: 1.5;
			}

			button {
				border: none;
				border-radius: 10px;
				padding: 10px 14px;
				font-size: 14px;
				font-weight: 700;
				cursor: pointer;
				color: #101010;
				background: #19f5d0;
			}

			button:hover {
				background: #52ffe0;
			}

			.secondary-btn {
				background: #333333;
				color: #f3f3f3;
				border: 1px solid #444444;
			}

			.secondary-btn:hover {
				background: #3f3f3f;
			}

			.preview {
				margin-top: 16px;
				background: #111111;
				border: 1px solid #333333;
				border-radius: 12px;
				padding: 16px;
				min-height: 120px;
				white-space: pre-wrap;
				overflow-x: auto;
				color: #eaeaea;
				font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
				font-size: 13px;
				line-height: 1.55;
			}

			.actions {
				margin-top: 14px;
				display: flex;
				gap: 10px;
			}

			.section-list {
				margin: 10px 0 0 0;
				padding-left: 20px;
				line-height: 1.6;
			}

			.critical-list li {
				color: #ff5c5c;
				margin-bottom: 8px;
			}

			.warning-list li {
				color: #ffd84d;
				margin-bottom: 8px;
			}
		</style>
	</head>

	<body>
		<div class="page">
			<div class="header">
				<div class="file-name">${fileName}</div>

				<div class="summary">
					<div class="badge critical">
						❌ ${result.criticalErrors.length} Critical Errors
					</div>

					<div class="badge warning">
						⚠ ${result.warnings.length} Warnings
					</div>
				</div>
			</div>

		<div class="card">
	<div class="card-header">
		<div>
			<h2>Testbench Generator</h2>
		</div>

		<div class="top-actions">
			<button id="generateBtn" onclick="generateTestbench()">
				Generate Testbench
			</button>

			<button
				id="addTbBtnTop"
				class="secondary-btn"
				style="display:none;"
				onclick="addToProject()"
			>
				Add to Project
			</button>

			<button
				id="clearTbBtn"
				class="clear-btn"
				title="Clear testbench"
				onclick="clearTestbench()"
			>
				Clear
			</button>
		</div>
	</div>

	<pre id="tbPreview" class="preview">Click "Generate Testbench" to preview output.</pre>

	<div class="actions">
		<button
			id="addTbBtnBottom"
			style="display:none;"
			onclick="addToProject()"
		>
			Add to Project
		</button>
	</div>
</div>	

		<div class="card">
				<h2>Critical Errors</h2>
				<ul class="section-list critical-list">
					${criticalHTML}
				</ul>
			</div>

			<div class="card">
				<h2>Warnings</h2>
				<ul class="section-list warning-list">
					${warningHTML}
				</ul>
			</div>
		</div>

	<script>
	const vscode = acquireVsCodeApi();

	let generatedTB = "";
	let isGenerating = false;
	let isPaused = false;
	let queuedChunks = "";
	let ignoreIncoming = false;

	function generateTestbench() {
		const preview = document.getElementById("tbPreview");
		const button = document.getElementById("generateBtn");

		if (isGenerating) {
			isPaused = !isPaused;

			if (isPaused) {
				button.textContent = "Resume";
			} else {
				button.textContent = "Pause";

				if (queuedChunks.length > 0) {
					generatedTB += queuedChunks;
					queuedChunks = "";
					preview.textContent = generatedTB;
				}
			}

			return;
		}

		ignoreIncoming = false;
		isGenerating = true;
		isPaused = false;
		generatedTB = "";
		queuedChunks = "";

		button.textContent = "Pause";

		hideAddButtons();

		preview.textContent =
			'Generating AI testbench with Ollama...\\n\\nThis may take a few seconds.';

		vscode.postMessage({
			command: "generateTestbench"
		});
	}

	function addToProject() {
		vscode.postMessage({
			command: "addTestbenchToProject",
			testbenchText: generatedTB
		});
	}

	function clearTestbench() {
		generatedTB = "";
		queuedChunks = "";
		isGenerating = false;
		isPaused = false;
		ignoreIncoming = true;

		document.getElementById("tbPreview").textContent =
			'Click "Generate Testbench" to preview output.';

		document.getElementById("generateBtn").disabled = false;
		document.getElementById("generateBtn").textContent =
			"Generate Testbench";

		hideAddButtons();
	}

	function showAddButtons() {
		document.getElementById("addTbBtnTop").style.display =
			"inline-block";

		document.getElementById("addTbBtnBottom").style.display =
			"inline-block";
	}

	function hideAddButtons() {
		document.getElementById("addTbBtnTop").style.display =
			"none";

		document.getElementById("addTbBtnBottom").style.display =
			"none";
	}

	window.addEventListener("message", event => {
		const message = event.data;

		if (ignoreIncoming) {
			return;
		}

		if (message.command === "startGeneratedTestbench") {
			generatedTB = "";
			queuedChunks = "";

			document.getElementById("tbPreview").textContent =
				"Starting Ollama generation...";

			hideAddButtons();
		}

		if (message.command === "appendGeneratedTestbench") {
			if (isPaused) {
				queuedChunks += message.chunk;
				return;
			}

			generatedTB += message.chunk;

			document.getElementById("tbPreview").textContent =
				generatedTB;
		}

		if (message.command === "showFinalGeneratedTestbench") {
			generatedTB = message.testbenchText;

			document.getElementById("tbPreview").textContent =
				generatedTB;
		}

		if (message.command === "finishGeneratedTestbench") {
			isGenerating = false;
			isPaused = false;
			queuedChunks = "";

			document.getElementById("generateBtn").disabled = false;
			document.getElementById("generateBtn").textContent =
				"Generate Testbench";

			showAddButtons();
		}
	});
</script>

	</body>
	</html>
	`;
}

export function deactivate() {}