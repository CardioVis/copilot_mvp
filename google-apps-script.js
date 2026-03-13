// ============================================================
// Google Apps Script — Zone File Read/Write
// ============================================================
//
// SETUP:
//   1. Go to https://script.google.com and create a new project
//   2. Replace the default Code.gs content with this file
//   3. Set FILE_ID below to the ID of a .txt file on your Drive
//      (create an empty .txt file on Drive, right-click → "Get link",
//       the ID is the long string between /d/ and /edit)
//   4. Click Deploy → New deployment
//      - Type: Web app
//      - Execute as: Me
//      - Who has access: Anyone
//   5. Copy the deployed URL and paste it into the app sidebar
//
// ============================================================

const FILE_ID = "PASTE_YOUR_DRIVE_FILE_ID_HERE";

/** GET — return file contents as plain text */
function doGet() {
  const file = DriveApp.getFileById(FILE_ID);
  const content = file.getBlob().getDataAsString();
  return ContentService.createTextOutput(content).setMimeType(
    ContentService.MimeType.TEXT
  );
}

/** POST — overwrite file contents with body.content */
function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  const file = DriveApp.getFileById(FILE_ID);
  file.setContent(data.content);
  return ContentService.createTextOutput("OK").setMimeType(
    ContentService.MimeType.TEXT
  );
}
