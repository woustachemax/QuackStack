-- CreateTable
CREATE TABLE "CodeSnippet" (
    "id" SERIAL NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "projectName" TEXT NOT NULL,
    "language" TEXT,
    "functionName" TEXT,
    "lineStart" INTEGER,
    "lineEnd" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CodeSnippet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CodeSnippet_projectName_idx" ON "CodeSnippet"("projectName");
