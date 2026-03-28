-- AlterTable
ALTER TABLE "Problem" ADD COLUMN     "acceptanceRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "acceptedSubmissions" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalSubmissions" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "acceptedSubmissions" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "problemsSolved" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalSubmissions" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Submission" (
    "id" SERIAL NOT NULL,
    "problemId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "runtime" INTEGER,
    "memory" INTEGER,
    "passedTests" INTEGER NOT NULL DEFAULT 0,
    "totalTests" INTEGER NOT NULL DEFAULT 0,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestResult" (
    "id" SERIAL NOT NULL,
    "submissionId" INTEGER NOT NULL,
    "testCaseId" INTEGER NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "userOutput" TEXT,
    "expectedOutput" TEXT,
    "runtime" INTEGER,
    "error" TEXT,

    CONSTRAINT "TestResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProblemProgress" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "problemId" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "acceptedSubmissions" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptedAt" TIMESTAMP(3),
    "solvedAt" TIMESTAMP(3),
    "bestRuntime" INTEGER,

    CONSTRAINT "ProblemProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Submission_userId_idx" ON "Submission"("userId");

-- CreateIndex
CREATE INDEX "Submission_problemId_idx" ON "Submission"("problemId");

-- CreateIndex
CREATE INDEX "Submission_status_idx" ON "Submission"("status");

-- CreateIndex
CREATE INDEX "Submission_submittedAt_idx" ON "Submission"("submittedAt");

-- CreateIndex
CREATE INDEX "TestResult_submissionId_idx" ON "TestResult"("submissionId");

-- CreateIndex
CREATE INDEX "ProblemProgress_userId_idx" ON "ProblemProgress"("userId");

-- CreateIndex
CREATE INDEX "ProblemProgress_status_idx" ON "ProblemProgress"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ProblemProgress_userId_problemId_key" ON "ProblemProgress"("userId", "problemId");

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestResult" ADD CONSTRAINT "TestResult_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestResult" ADD CONSTRAINT "TestResult_testCaseId_fkey" FOREIGN KEY ("testCaseId") REFERENCES "TestCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProblemProgress" ADD CONSTRAINT "ProblemProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProblemProgress" ADD CONSTRAINT "ProblemProgress_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
