-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "TenantRole" AS ENUM ('ADMIN', 'APPROVER', 'MEMBER');

-- CreateEnum
CREATE TYPE "ApprovalStrategy" AS ENUM ('SINGLE', 'ALL', 'QUORUM');

-- CreateEnum
CREATE TYPE "ApprovalRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('USER_REGISTERED', 'WORKFLOW_CREATED', 'WORKFLOW_VERSION_CREATED', 'ITEM_CREATED', 'TRANSITION_REQUESTED', 'ITEM_TRANSITIONED', 'APPROVAL_CREATED', 'APPROVAL_APPROVED', 'APPROVAL_REJECTED', 'DELEGATION_CREATED', 'DELEGATION_REVOKED', 'SLA_BREACHED');

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_memberships" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "TenantRole" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflows" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "active_version_id" UUID,
    "sla_duration_minutes" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_versions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "workflow_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_states" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "workflow_version_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "is_initial" BOOLEAN NOT NULL DEFAULT false,
    "is_final" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_transitions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "workflow_version_id" UUID NOT NULL,
    "from_state_id" UUID NOT NULL,
    "to_state_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "requires_approval" BOOLEAN NOT NULL DEFAULT false,
    "approval_strategy" "ApprovalStrategy",
    "approver_role" "TenantRole",
    "quorum_count" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_transitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "items" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "workflow_version_id" UUID NOT NULL,
    "current_state_id" UUID NOT NULL,
    "created_by_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "sla_breached_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_requests" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "transition_id" UUID NOT NULL,
    "requested_by_id" UUID NOT NULL,
    "item_version" INTEGER NOT NULL,
    "status" "ApprovalRequestStatus" NOT NULL DEFAULT 'PENDING',
    "idempotency_key" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMPTZ(6),

    CONSTRAINT "approval_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approvals" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "approval_request_id" UUID NOT NULL,
    "assigned_approver_id" UUID NOT NULL,
    "decided_by_id" UUID,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "comment" TEXT,
    "decided_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delegations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "delegator_id" UUID NOT NULL,
    "delegate_id" UUID NOT NULL,
    "valid_from" TIMESTAMPTZ(6) NOT NULL,
    "valid_to" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delegations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "actor_user_id" UUID,
    "item_id" UUID,
    "action" "AuditAction" NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "tenant_memberships_user_id_idx" ON "tenant_memberships"("user_id");

-- CreateIndex
CREATE INDEX "tenant_memberships_tenant_id_role_idx" ON "tenant_memberships"("tenant_id", "role");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_memberships_tenant_id_user_id_key" ON "tenant_memberships"("tenant_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "workflows_active_version_id_key" ON "workflows"("active_version_id");

-- CreateIndex
CREATE INDEX "workflows_tenant_id_idx" ON "workflows"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "workflows_tenant_id_slug_key" ON "workflows"("tenant_id", "slug");

-- CreateIndex
CREATE INDEX "workflow_versions_tenant_id_workflow_id_idx" ON "workflow_versions"("tenant_id", "workflow_id");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_versions_workflow_id_version_key" ON "workflow_versions"("workflow_id", "version");

-- CreateIndex
CREATE INDEX "workflow_states_tenant_id_workflow_version_id_idx" ON "workflow_states"("tenant_id", "workflow_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_states_workflow_version_id_key_key" ON "workflow_states"("workflow_version_id", "key");

-- CreateIndex
CREATE INDEX "workflow_transitions_tenant_id_workflow_version_id_idx" ON "workflow_transitions"("tenant_id", "workflow_version_id");

-- CreateIndex
CREATE INDEX "workflow_transitions_tenant_id_approver_role_idx" ON "workflow_transitions"("tenant_id", "approver_role");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_transitions_workflow_version_id_from_state_id_to_s_key" ON "workflow_transitions"("workflow_version_id", "from_state_id", "to_state_id");

-- CreateIndex
CREATE INDEX "items_tenant_id_current_state_id_created_at_idx" ON "items"("tenant_id", "current_state_id", "created_at");

-- CreateIndex
CREATE INDEX "items_tenant_id_workflow_version_id_idx" ON "items"("tenant_id", "workflow_version_id");

-- CreateIndex
CREATE INDEX "items_tenant_id_updated_at_idx" ON "items"("tenant_id", "updated_at");

-- CreateIndex
CREATE INDEX "approval_requests_tenant_id_item_id_status_idx" ON "approval_requests"("tenant_id", "item_id", "status");

-- CreateIndex
CREATE INDEX "approval_requests_tenant_id_transition_id_idx" ON "approval_requests"("tenant_id", "transition_id");

-- CreateIndex
CREATE UNIQUE INDEX "approval_requests_tenant_id_idempotency_key_key" ON "approval_requests"("tenant_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "approvals_tenant_id_assigned_approver_id_status_idx" ON "approvals"("tenant_id", "assigned_approver_id", "status");

-- CreateIndex
CREATE INDEX "approvals_tenant_id_status_idx" ON "approvals"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "approvals_approval_request_id_assigned_approver_id_key" ON "approvals"("approval_request_id", "assigned_approver_id");

-- CreateIndex
CREATE INDEX "delegations_tenant_id_delegator_id_revoked_at_idx" ON "delegations"("tenant_id", "delegator_id", "revoked_at");

-- CreateIndex
CREATE INDEX "delegations_tenant_id_delegate_id_valid_from_valid_to_idx" ON "delegations"("tenant_id", "delegate_id", "valid_from", "valid_to");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_entity_type_entity_id_created_at_idx" ON "audit_logs"("tenant_id", "entity_type", "entity_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_item_id_created_at_idx" ON "audit_logs"("tenant_id", "item_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_created_at_idx" ON "audit_logs"("tenant_id", "created_at");

-- AddForeignKey
ALTER TABLE "tenant_memberships" ADD CONSTRAINT "tenant_memberships_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_memberships" ADD CONSTRAINT "tenant_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_active_version_id_fkey" FOREIGN KEY ("active_version_id") REFERENCES "workflow_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_versions" ADD CONSTRAINT "workflow_versions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_versions" ADD CONSTRAINT "workflow_versions_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_states" ADD CONSTRAINT "workflow_states_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_states" ADD CONSTRAINT "workflow_states_workflow_version_id_fkey" FOREIGN KEY ("workflow_version_id") REFERENCES "workflow_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_transitions" ADD CONSTRAINT "workflow_transitions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_transitions" ADD CONSTRAINT "workflow_transitions_workflow_version_id_fkey" FOREIGN KEY ("workflow_version_id") REFERENCES "workflow_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_transitions" ADD CONSTRAINT "workflow_transitions_from_state_id_fkey" FOREIGN KEY ("from_state_id") REFERENCES "workflow_states"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_transitions" ADD CONSTRAINT "workflow_transitions_to_state_id_fkey" FOREIGN KEY ("to_state_id") REFERENCES "workflow_states"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_workflow_version_id_fkey" FOREIGN KEY ("workflow_version_id") REFERENCES "workflow_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_current_state_id_fkey" FOREIGN KEY ("current_state_id") REFERENCES "workflow_states"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_transition_id_fkey" FOREIGN KEY ("transition_id") REFERENCES "workflow_transitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_approval_request_id_fkey" FOREIGN KEY ("approval_request_id") REFERENCES "approval_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_assigned_approver_id_fkey" FOREIGN KEY ("assigned_approver_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delegations" ADD CONSTRAINT "delegations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delegations" ADD CONSTRAINT "delegations_delegator_id_fkey" FOREIGN KEY ("delegator_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delegations" ADD CONSTRAINT "delegations_delegate_id_fkey" FOREIGN KEY ("delegate_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

