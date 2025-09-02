-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Token" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "scope" TEXT NOT NULL,
    "expiryDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Token_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "domainKey" TEXT NOT NULL,
    "firstSeen" DATETIME NOT NULL,
    "lastSeen" DATETIME NOT NULL,
    "evidenceCount" INTEGER NOT NULL DEFAULT 0,
    "unsubscribeUrl" TEXT,
    "confidence" REAL NOT NULL,
    CONSTRAINT "Vendor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SyncState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "historyId" TEXT,
    "lastScanAt" DATETIME,
    CONSTRAINT "SyncState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Token_userId_provider_key" ON "Token"("userId", "provider");

-- CreateIndex
CREATE INDEX "Vendor_userId_brand_idx" ON "Vendor"("userId", "brand");

-- CreateIndex
CREATE UNIQUE INDEX "Vendor_userId_brand_domainKey_key" ON "Vendor"("userId", "brand", "domainKey");

-- CreateIndex
CREATE UNIQUE INDEX "SyncState_userId_key" ON "SyncState"("userId");
