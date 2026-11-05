import { spawn } from "node:child_process";

/** Explicit user-triggered native picker; paths never become shell command text. */
export async function chooseProjectFolder(initialDirectory?: string): Promise<string | null> {
  if (process.platform !== "win32") throw new Error("Paste the full project folder path here. The native folder picker is currently available on Windows.");
  const script = `Add-Type -AssemblyName System.Windows.Forms
$taskFolderDialog = New-Object System.Windows.Forms.FolderBrowserDialog
$taskFolderDialog.Description = 'Choose the project Hypothra should understand'
$taskFolderDialog.ShowNewFolderButton = $false
if ($env:HYPOTHRA_INITIAL_FOLDER) { $taskFolderDialog.SelectedPath = $env:HYPOTHRA_INITIAL_FOLDER }
$taskFolderOwner = New-Object System.Windows.Forms.Form
$taskFolderOwner.TopMost = $true
$taskFolderOwner.ShowInTaskbar = $false
$taskFolderOwner.Opacity = 0
$taskFolderOwner.Show()
try { if ($taskFolderDialog.ShowDialog($taskFolderOwner) -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false); [Console]::WriteLine($taskFolderDialog.SelectedPath) } }
finally { $taskFolderDialog.Dispose(); $taskFolderOwner.Close(); $taskFolderOwner.Dispose() }`;
  return new Promise((resolve, reject) => {
    const child = spawn("powershell.exe", ["-NoProfile", "-STA", "-Command", script], { windowsHide: true,
      env: { ...process.env, HYPOTHRA_INITIAL_FOLDER: initialDirectory ?? "" }, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.setEncoding("utf8");
    const timer = setTimeout(() => { child.kill(); reject(new Error("Folder selection timed out. Try again or paste the project path.")); }, 180_000);
    child.stdout.on("data", chunk => { output += chunk.toString("utf8"); if (output.length > 32_768) child.kill(); });
    child.stderr.on("data", () => {});
    child.once("error", () => { clearTimeout(timer); reject(new Error("The folder picker could not open. Paste the full project path instead.")); });
    child.once("close", code => { clearTimeout(timer); if (code !== 0) reject(new Error("The folder picker did not finish. Paste the full project path instead.")); else resolve(output.trim() || null); });
  });
}
