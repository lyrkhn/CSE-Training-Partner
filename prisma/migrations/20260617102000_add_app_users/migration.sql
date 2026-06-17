CREATE TABLE "AppUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" TEXT,
    "role" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppUser_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AppUser_email_key" ON "AppUser"("email");
CREATE INDEX "AppUser_role_idx" ON "AppUser"("role");
CREATE INDEX "AppUser_updatedAt_idx" ON "AppUser"("updatedAt");
