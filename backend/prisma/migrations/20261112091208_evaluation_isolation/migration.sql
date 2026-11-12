-- AlterTable
ALTER TABLE "AgentRun" ADD COLUMN     "isEvaluation" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "isEvaluation" BOOLEAN NOT NULL DEFAULT false;
