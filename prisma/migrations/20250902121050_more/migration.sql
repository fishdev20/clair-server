-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SyncState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "isRunning" BOOLEAN NOT NULL DEFAULT false,
    "processed" INTEGER NOT NULL DEFAULT 0,
    "vendors" INTEGER NOT NULL DEFAULT 0,
    "nextPage" TEXT,
    "phase" TEXT NOT NULL DEFAULT 'idle',
    "historyId" TEXT,
    "lastScanAt" DATETIME,
    CONSTRAINT "SyncState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_SyncState" ("historyId", "id", "lastScanAt", "userId") SELECT "historyId", "id", "lastScanAt", "userId" FROM "SyncState";
DROP TABLE "SyncState";
ALTER TABLE "new_SyncState" RENAME TO "SyncState";
CREATE UNIQUE INDEX "SyncState_userId_key" ON "SyncState"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
