-- CreateTable
CREATE TABLE "HomepageConfig" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sections" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomepageConfig_pkey" PRIMARY KEY ("id")
);
