import { VerificationResult } from "./checker";

export function getReportWebview(
	result: VerificationResult,
	preAnalysis: any
): string {
	const fileName =
		result.fileName.split(/[\\/]/).pop() || result.fileName;

	const criticalHTML =
		result.criticalErrors.length > 0
			? result.criticalErrors.map(error => `<li>${error}</li>`).join("")
			: "<li>No critical errors found.</li>";

	const warningHTML =
		result.warnings.length > 0
			? result.warnings.map(warning => `<li>${warning}</li>`).join("")
			: "<li>No warnings found.</li>";

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

		.badge.clickable {
			cursor: pointer;

			transition:
				transform 0.08s ease,
				filter 0.12s ease;
		}

		.badge.clickable:hover {
			filter: brightness(1.18);
		}

		.badge.clickable:active {
			transform: scale(0.96);
		}

		.badge.critical {
			color: #ff5c5c;
			border-color: rgba(255, 92, 92, 0.35);
		}

		.badge.warning {
			color: #ffd84d;
			border-color: rgba(255, 216, 77, 0.35);
		}

		.badge.analysis {
			color: #19f5d0;
			border-color: rgba(25, 245, 208, 0.35);
			background: rgba(25, 245, 208, 0.08);
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
			background: rgba(255, 92, 92, 0.08);
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
			background: rgba(255, 92, 92, 0.16);
		}

		h2 {
			margin: 0;
			font-size: 22px;
			font-weight: 750;
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

			transition:
				transform 0.08s ease,
				filter 0.12s ease,
				box-shadow 0.12s ease;
		}

		button:hover {
			background: #52ffe0;
		}

		button:active {
			transform: translateY(2px) scale(0.98);
		}

		.secondary-btn {
			background: #333333;
			color: #f3f3f3;
			border: 1px solid #444444;
		}

		.secondary-btn:hover {
			background: #3f3f3f;
		}

		.hidden {
			display: none !important;
		}

		.details-card {
			display: none;
			margin-top: -8px;
		}

		.details-card.visible {
			display: block;
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

		.settings-panel {
			margin-top: 14px;
			padding: 14px;
			border-radius: 12px;
			background: #161616;
			border: 1px solid #333333;
			display: flex;
			flex-direction: column;
			gap: 12px;
		}

		.settings-panel.hidden {
			display: none;
		}

		.settings-panel label {
			font-size: 13px;
			font-weight: 600;
			color: #dddddd;
			display: flex;
			flex-direction: column;
			gap: 6px;
		}

		.settings-panel input,
		.settings-panel select,
		.settings-panel textarea {
			background: #222222;
			color: #f3f3f3;
			border: 1px solid #444444;
			border-radius: 8px;
			padding: 8px;
			font-size: 13px;
		}

		.settings-panel textarea {
			resize: vertical;
			min-height: 100px;
		}

		.custom-settings {
			display: flex;
			flex-direction: column;
			gap: 10px;
			padding-top: 10px;
			border-top: 1px solid #333333;
		}

		.checkbox-row {
			display: flex;
			align-items: center;
			gap: 8px;
			font-size: 13px;
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
				<div id="criticalBadge" class="badge critical clickable">
					❌ ${result.criticalErrors.length} Critical Errors
				</div>

				<div id="warningBadge" class="badge warning clickable">
					⚠ ${result.warnings.length} Warnings
				</div>

				<div class="badge analysis">
					${preAnalysis.summary}
				</div>
			</div>
		</div>

		<div id="criticalDetails" class="card details-card">
			<h2>Critical Errors</h2>
			<ul class="section-list critical-list">
				${criticalHTML}
			</ul>
		</div>

		<div id="warningDetails" class="card details-card">
			<h2>Warnings</h2>
			<ul class="section-list warning-list">
				${warningHTML}
			</ul>
		</div>

		<div class="card">
			<div class="card-header">
				<h2>Testbench Generator</h2>

				<div class="top-actions">
					<button id="generateBtn">Generate Testbench</button>

					<button id="settingsBtn" class="secondary-btn">
						Settings
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

			<div id="settingsPanel" class="settings-panel hidden">
				<label>
					Testbench Depth

					<select id="tbDepth">
						<option value="basic">Basic</option>
						<option value="standard" selected>Standard</option>
						<option value="exhaustive">Exhaustive</option>
						<option value="custom">Custom</option>
					</select>
				</label>

				<div id="customSettings" class="custom-settings hidden">
					<label>
						Number of test cases
						<input id="customCaseCount" type="number" min="1" max="1000" value="20" />
					</label>

					<label class="checkbox-row">
						<input id="includeEdgeCases" type="checkbox" checked />
						Include edge cases
					</label>

					<label class="checkbox-row">
						<input id="includeInvalidInputs" type="checkbox" checked />
						Include invalid inputs
					</label>

					<label class="checkbox-row">
						<input id="includeRandomTests" type="checkbox" />
						Include randomized tests
					</label>

					<label class="checkbox-row">
						<input id="includeAssertions" type="checkbox" checked />
						Include assertions
					</label>

					<label class="checkbox-row">
						<input id="includeSelfChecking" type="checkbox" checked />
						Include self-checking
					</label>

					<label class="checkbox-row">
						<input id="includeWaveDump" type="checkbox" checked />
						Include waveform dumping
					</label>

					<label class="checkbox-row">
						<input id="includeComments" type="checkbox" checked />
						Include comments
					</label>

					<label>
						Custom AI instructions
						<textarea
							id="customPrompt"
							placeholder="Example: Add overflow testing, reset glitches, and protocol timing checks."
						></textarea>
					</label>
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
			<div class="card-header">
				<div>
					<h2>Synthesis</h2>

					<p
						style="
							margin-top: 6px;
							color: #9f9f9f;
							font-size: 14px;
							font-weight: 500;
						"
					>
						Generate hardware.
					</p>
				</div>

				<div class="top-actions">
					<button id="runSynthesisBtn">
						Generate
					</button>
				</div>
			</div>
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

		const settingsBtn = document.getElementById("settingsBtn");
		const settingsPanel = document.getElementById("settingsPanel");
		const tbDepth = document.getElementById("tbDepth");
		const customSettings = document.getElementById("customSettings");

		function toggleDetails(idToToggle) {
			const criticalDetails = document.getElementById("criticalDetails");
			const warningDetails = document.getElementById("warningDetails");

			const target = document.getElementById(idToToggle);
			const isVisible = target.classList.contains("visible");

			criticalDetails.classList.remove("visible");
			warningDetails.classList.remove("visible");

			if (!isVisible) {
				target.classList.add("visible");
			}
		}

		function sendTestbenchSettings() {
			const selectedDepth = document.getElementById("tbDepth").value;
			const isCustom = selectedDepth === "custom";

			customSettings.classList.toggle("hidden", !isCustom);

			const settings = {
				testbenchDepth: selectedDepth,

				customCaseCount: Number(
					document.getElementById("customCaseCount").value
				),

				includeEdgeCases:
					document.getElementById("includeEdgeCases").checked,

				includeInvalidInputs:
					document.getElementById("includeInvalidInputs").checked,

				includeRandomTests:
					document.getElementById("includeRandomTests").checked,

				includeAssertions:
					document.getElementById("includeAssertions").checked,

				includeSelfChecking:
					document.getElementById("includeSelfChecking").checked,

				includeWaveDump:
					document.getElementById("includeWaveDump").checked,

				includeComments:
					document.getElementById("includeComments").checked,

				customPrompt:
					document.getElementById("customPrompt").value
			};

			vscode.postMessage({
				command: "updateTestbenchSettings",
				settings
			});
		}

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
				"Generating AI testbench with Ollama...";

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

		document
			.getElementById("criticalBadge")
			.addEventListener("click", () => {
				toggleDetails("criticalDetails");
			});

		document
			.getElementById("warningBadge")
			.addEventListener("click", () => {
				toggleDetails("warningDetails");
			});

		settingsBtn.addEventListener("click", () => {
			settingsPanel.classList.toggle("hidden");
		});

		tbDepth.addEventListener("change", sendTestbenchSettings);

		[
			"customCaseCount",
			"includeEdgeCases",
			"includeInvalidInputs",
			"includeRandomTests",
			"includeAssertions",
			"includeSelfChecking",
			"includeWaveDump",
			"includeComments",
			"customPrompt"
		].forEach(id => {
			const el = document.getElementById(id);

			el.addEventListener("input", sendTestbenchSettings);
			el.addEventListener("change", sendTestbenchSettings);
		});

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
					"Starting generation...";

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

		sendTestbenchSettings();

		document
		.getElementById("runSynthesisBtn")
		.addEventListener("click", () => {

			vscode.postMessage({
				command: "runSynthesis"
			});
		});


	</script>
</body>
</html>
`;
}