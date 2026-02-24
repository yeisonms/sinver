Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "node.exe """ & CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName) & "\index.js""", 0, False
Set WshShell = Nothing
