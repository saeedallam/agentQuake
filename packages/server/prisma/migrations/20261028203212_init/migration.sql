-- CreateEnum
CREATE TYPE "ToolKind" AS ENUM ('HTTP', 'MCP');

-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "projects" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tools" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "kind" "ToolKind" NOT NULL DEFAULT 'HTTP',
    "base_url" TEXT NOT NULL,
    "timeout_ms" INTEGER NOT NULL DEFAULT 30000,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "tools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scenarios" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "source_yaml" TEXT NOT NULL,
    "definition" JSONB NOT NULL,
    "checksum" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "scenarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "runs" (
    "id" UUID NOT NULL,
    "scenario_id" UUID NOT NULL,
    "status" "RunStatus" NOT NULL DEFAULT 'PENDING',
    "seed" INTEGER NOT NULL,
    "scenario_snapshot" JSONB NOT NULL,
    "started_at" TIMESTAMPTZ(3),
    "finished_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "traces" (
    "id" UUID NOT NULL,
    "run_id" UUID NOT NULL,
    "tool_id" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "query" TEXT,
    "request_headers" JSONB NOT NULL,
    "request_body" TEXT,
    "response_status" INTEGER,
    "response_headers" JSONB,
    "response_body" TEXT,
    "body_truncated" BOOLEAN NOT NULL DEFAULT false,
    "started_at" TIMESTAMPTZ(3) NOT NULL,
    "duration_ms" INTEGER NOT NULL,
    "upstream_duration_ms" INTEGER,
    "error_code" TEXT,

    CONSTRAINT "traces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trace_faults" (
    "id" UUID NOT NULL,
    "trace_id" UUID NOT NULL,
    "rule_id" TEXT NOT NULL,
    "fault_type" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "applied_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trace_faults_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "projects_slug_key" ON "projects"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "tools_project_id_slug_key" ON "tools"("project_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "scenarios_project_id_name_key" ON "scenarios"("project_id", "name");

-- CreateIndex
CREATE INDEX "runs_scenario_id_created_at_idx" ON "runs"("scenario_id", "created_at");

-- CreateIndex
CREATE INDEX "traces_tool_id_idx" ON "traces"("tool_id");

-- CreateIndex
CREATE UNIQUE INDEX "traces_run_id_sequence_key" ON "traces"("run_id", "sequence");

-- CreateIndex
CREATE INDEX "trace_faults_trace_id_idx" ON "trace_faults"("trace_id");

-- CreateIndex
CREATE INDEX "trace_faults_fault_type_idx" ON "trace_faults"("fault_type");

-- AddForeignKey
ALTER TABLE "tools" ADD CONSTRAINT "tools_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenarios" ADD CONSTRAINT "scenarios_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "runs" ADD CONSTRAINT "runs_scenario_id_fkey" FOREIGN KEY ("scenario_id") REFERENCES "scenarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "traces" ADD CONSTRAINT "traces_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "traces" ADD CONSTRAINT "traces_tool_id_fkey" FOREIGN KEY ("tool_id") REFERENCES "tools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trace_faults" ADD CONSTRAINT "trace_faults_trace_id_fkey" FOREIGN KEY ("trace_id") REFERENCES "traces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
