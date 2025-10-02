/*
  Warnings:

  - You are about to drop the `CodeSnippet` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "public"."CodeSnippet";

-- CreateTable
CREATE TABLE "codeSnippet" (
    "id" SERIAL NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" JSONB NOT NULL,
    "filePath" TEXT NOT NULL,
    "projectName" TEXT NOT NULL,
    "language" TEXT,
    "functionName" TEXT,
    "lineStart" INTEGER,
    "lineEnd" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "codeSnippet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "codeSnippet_projectName_idx" ON "codeSnippet"("projectName");
