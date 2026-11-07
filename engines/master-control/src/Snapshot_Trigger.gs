function createDailyMasterControlSnapshot() {
  const SOURCE_SPREADSHEET_ID = PropertiesService.getScriptProperties().getProperty('MASTER_CONTROL_SHEET_ID') || SpreadsheetApp.getActiveSpreadsheet().getId();
  const BACKUP_FOLDER_ID = PropertiesService.getScriptProperties().getProperty('BACKUP_DRIVE_FOLDER_ID');
  
  const source = SpreadsheetApp.openById(SOURCE_SPREADSHEET_ID);
  const now = new Date();
  const dateStamp = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd_HHmmss');
  const backupName = `Master_Control_Snapshot_${dateStamp}`;
  
  let backupFile;
  if (BACKUP_FOLDER_ID) {
    const folder = DriveApp.getFolderById(BACKUP_FOLDER_ID);
    backupFile = DriveApp.getFileById(SOURCE_SPREADSHEET_ID).makeCopy(backupName, folder);
  } else {
    backupFile = DriveApp.getFileById(SOURCE_SPREADSHEET_ID).makeCopy(backupName);
  }
  
  console.log(`Snapshot created: ${backupName} (ID: ${backupFile.getId()})`);
  
  // Prune snapshots older than 30 days
  const retentionMs = 30 * 24 * 60 * 60 * 1000;
  const cutoff = new Date(now.getTime() - retentionMs);
  
  const files = BACKUP_FOLDER_ID 
    ? DriveApp.getFolderById(BACKUP_FOLDER_ID).getFiles() 
    : DriveApp.getFilesByName(backupName);
    
  while (files.hasNext()) {
    const f = files.next();
    if (f.getName().startsWith('Master_Control_Snapshot_') && f.getDateCreated() < cutoff) {
      console.log(`Pruning expired snapshot: ${f.getName()}`);
      f.setTrashed(true);
    }
  }
}
