"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { PasswordInput } from "@/components/auth/password-input";
import { PasswordPolicyHints } from "@/components/auth/password-policy-hints";

export function SecurityTab() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleUpdate() {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("All fields are required");
      return;
    }
    if (newPassword.length < 10) {
      toast.error("New password must be at least 10 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New password and confirmation don't match");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/user/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to update password");
      }
      toast.success("Password updated successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update password");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="border-slate-200">
      <CardHeader>
        <CardTitle className="text-base">Security Settings</CardTitle>
        <CardDescription>Manage your password and account security.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5 max-w-sm">
          <Label>Current password</Label>
          <PasswordInput
            placeholder="Your current password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
            className="border-slate-300"
          />
        </div>
        <div className="space-y-1.5 max-w-sm">
          <Label>New password</Label>
          <PasswordInput
            placeholder="Pick a strong password you'll remember"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            className="border-slate-300"
          />
          <PasswordPolicyHints password={newPassword} />
        </div>
        <div className="space-y-1.5 max-w-sm">
          <Label>Confirm new password</Label>
          <PasswordInput
            placeholder="Re-enter your new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            className="border-slate-300"
          />
          {confirmPassword.length > 0 && confirmPassword !== newPassword && (
            <p className="text-xs text-red-500">Passwords don&apos;t match</p>
          )}
        </div>
        <Button
          onClick={handleUpdate}
          disabled={saving}
          className="bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
          Update password
        </Button>
      </CardContent>
    </Card>
  );
}
