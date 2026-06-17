-- Add account status so root admins can deactivate users without deleting them.
ALTER TABLE "AppUser" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX "AppUser_isActive_idx" ON "AppUser"("isActive");
