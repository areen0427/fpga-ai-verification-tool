import { VerificationResult } from "./checker";

export function getReportWebview(result: VerificationResult): string {
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

			.simulation-status {
				margin-top: 12px;
				font-size: 13px;
				font-weight: 600;
				color: var(--vscode-foreground);
			}

		.simulation-log {
			margin-top: 10px;
			padding: 10px;
			border-radius: 6px;
			background: var(--vscode-editor-background);
			color: var(--vscode-editor-foreground);
			border: 1px solid var(--vscode-panel-border);
			font-size: 12px;
			line-height: 1.4;
			max-height: 220px;
			overflow: auto;
			white-space: pre-wrap;
			display: none;
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
			<button id="generateBtn" >
				Generate Testbench
			</button>

			<button
				id="addTbBtnTop"
				class="secondary-btn"
				style="display:none; opacity:0.5;"
				disabled
			>
				Add to Project
			</button>

			<button
				id="clearTbBtn"
				class="clear-btn"
				title="Clear testbench"
			>
				Clear
			</button>
		</div>
	</div>

	<pre id="tbPreview" class="preview">Click "Generate Testbench" to preview output.</pre>

	<div id="simulationStatus" class="simulation-status"></div>

	<pre id="simulationLog" class="simulation-log"></pre>

	<div class="actions">
		<button
			id="addTbBtnBottom"
			class="secondary-btn"
			style="display:none; opacity:0.5;"
			disabled
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
	let canAddGeneratedTbToProject = false;

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
		canAddGeneratedTbToProject = false;

		button.textContent = "Pause";

		hideAddButtons();
		setSimulationStatus("");
		setSimulationLog("");

		preview.textContent =
			'Generating AI testbench with Ollama...';

		vscode.postMessage({
			command: "generateTestbench"
		});
	}

	function addToProject() {
		if (!canAddGeneratedTbToProject) {
			setSimulationStatus(
				"❌ Cannot add testbench until compile/simulation passes."
			);
			return;
		}

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
		canAddGeneratedTbToProject = false;

		document.getElementById("tbPreview").textContent =
			'Click "Generate Testbench" to preview output.';

		document.getElementById("generateBtn").disabled = false;
		document.getElementById("generateBtn").textContent =
			"Generate Testbench";

		hideAddButtons();
		setSimulationStatus("");
		setSimulationLog("");
	}

	function showAddButtonsDisabled() {
		const topBtn = document.getElementById("addTbBtnTop");
		const bottomBtn = document.getElementById("addTbBtnBottom");

		topBtn.style.display = "inline-block";
		bottomBtn.style.display = "inline-block";

		topBtn.disabled = true;
		bottomBtn.disabled = true;

		topBtn.style.opacity = "0.5";
		bottomBtn.style.opacity = "0.5";
	}

	function enableAddButtons() {
		const topBtn = document.getElementById("addTbBtnTop");
		const bottomBtn = document.getElementById("addTbBtnBottom");

		topBtn.style.display = "inline-block";
		bottomBtn.style.display = "inline-block";

		topBtn.disabled = false;
		bottomBtn.disabled = false;

		topBtn.style.opacity = "1";
		bottomBtn.style.opacity = "1";
	}

	function hideAddButtons() {
		const topBtn = document.getElementById("addTbBtnTop");
		const bottomBtn = document.getElementById("addTbBtnBottom");

		topBtn.style.display = "none";
		bottomBtn.style.display = "none";

		topBtn.disabled = true;
		bottomBtn.disabled = true;

		topBtn.style.opacity = "0.5";
		bottomBtn.style.opacity = "0.5";
	}

	function setSimulationStatus(text) {
		const el = document.getElementById("simulationStatus");

		if (el) {
			el.textContent = text;
		}
	}

	function setSimulationLog(text) {
		const el = document.getElementById("simulationLog");

		if (el) {
			el.textContent = text;

			if (text && text.trim().length > 0) {
				el.style.display = "block";
			} else {
				el.style.display = "none";
			}
		}
	}

	window.addEventListener("message", event => {
		const message = event.data;

		if (ignoreIncoming) {
			return;
		}

		if (message.command === "startGeneratedTestbench") {
			generatedTB = "";
			queuedChunks = "";
			canAddGeneratedTbToProject = false;

			document.getElementById("tbPreview").textContent =
				"Starting Ollama generation...";

			hideAddButtons();
			setSimulationStatus("");
			setSimulationLog("");
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

			showAddButtonsDisabled();

			setSimulationStatus(
				"Compiling and simulating generated testbench..."
			);

			vscode.postMessage({
				command: "verifyGeneratedTestbench",
				testbench: generatedTB
			});
		}

		if (message.command === "simulationResults") {
			const results = message.results;

			canAddGeneratedTbToProject =
				results.canAddToProject;

			if (results.canAddToProject) {
				enableAddButtons();

				setSimulationStatus(
					"✅ Compile and simulation passed. Testbench can be added."
				);
			} else {
				showAddButtonsDisabled();

				setSimulationStatus(
					"❌ Compile/simulation errors found. Regenerate or fix before adding."
				);
			}

			setSimulationLog(results.rawLog || "");
		}
	});

	document
		.getElementById("generateBtn")
		.addEventListener("click", generateTestbench);

	document
		.getElementById("addTbBtnTop")
		.addEventListener("click", addToProject);

	document
		.getElementById("addTbBtnBottom")
		.addEventListener("click", addToProject);

	document
		.getElementById("clearTbBtn")
		.addEventListener("click", clearTestbench);
</script>

	</body>
	</html>
	`;
}