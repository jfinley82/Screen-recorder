import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Save, Check } from "lucide-react";
import { cn } from "@/lib/utils";

function Field({
  label, id, type = "text", value, onChange, placeholder, maxLength,
}: {
  label: string; id: string; type?: string;
  value: string; onChange: (v: string) => void;
  placeholder?: string; maxLength?: number;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium">{label}</label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
      />
    </div>
  );
}

export default function ProfilePage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  // Profile fields
  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [website, setWebsite] = useState("");
  const [twitterUrl, setTwitterUrl] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [brandColor, setBrandColor] = useState("#7C3AED");
  const [profileSaved, setProfileSaved] = useState(false);

  // Password fields
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSaved, setPasswordSaved] = useState(false);

  useEffect(() => {
    if (!user) return;
    setName(user.name ?? "");
    setAvatarUrl((user as any).avatarUrl ?? "");
    setBusinessName((user as any).businessName ?? "");
    setWebsite((user as any).website ?? "");
    setTwitterUrl((user as any).twitterUrl ?? "");
    setLinkedinUrl((user as any).linkedinUrl ?? "");
    setYoutubeUrl((user as any).youtubeUrl ?? "");
    setInstagramUrl((user as any).instagramUrl ?? "");
    setBrandColor((user as any).brandColor ?? "#7C3AED");
  }, [user]);

  const updateProfile = trpc.auth.updateProfile.useMutation({
    onSuccess: () => {
      qc.invalidateQueries();
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2500);
    },
  });

  const changePassword = trpc.auth.changePassword.useMutation({
    onSuccess: () => {
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      setPasswordSaved(true);
      setTimeout(() => setPasswordSaved(false), 2500);
    },
    onError: (err) => setPasswordError(err.message),
  });

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile.mutate({
      name: name || undefined,
      avatarUrl: avatarUrl || null,
      businessName: businessName || null,
      website: website || null,
      twitterUrl: twitterUrl || null,
      linkedinUrl: linkedinUrl || null,
      youtubeUrl: youtubeUrl || null,
      instagramUrl: instagramUrl || null,
      brandColor: /^#[0-9A-Fa-f]{6}$/.test(brandColor) ? brandColor : undefined,
    });
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }
    changePassword.mutate({ currentPassword, newPassword });
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Profile</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your account details and branding.
        </p>
      </div>

      {/* Profile form */}
      <form onSubmit={handleProfileSubmit} className="space-y-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Personal Info
        </p>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Full Name" id="name" value={name} onChange={setName} placeholder="Jane Doe" maxLength={100} />
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Email</label>
            <input
              type="email"
              disabled
              value={user?.email ?? ""}
              className="w-full px-3 py-2 rounded-lg border border-border bg-secondary text-sm text-muted-foreground cursor-not-allowed"
            />
          </div>
        </div>

        <Field
          label="Logo / Avatar URL"
          id="avatarUrl"
          value={avatarUrl}
          onChange={setAvatarUrl}
          placeholder="https://example.com/avatar.png"
          maxLength={1024}
        />

        <hr className="border-border" />
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Business
        </p>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Business Name" id="businessName" value={businessName} onChange={setBusinessName} placeholder="Acme Corp" maxLength={255} />
          <Field label="Website" id="website" type="url" value={website} onChange={setWebsite} placeholder="https://acme.com" maxLength={512} />
        </div>

        <hr className="border-border" />
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Social Media
        </p>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Twitter / X URL" id="twitter" type="url" value={twitterUrl} onChange={setTwitterUrl} placeholder="https://twitter.com/you" maxLength={512} />
          <Field label="LinkedIn URL" id="linkedin" type="url" value={linkedinUrl} onChange={setLinkedinUrl} placeholder="https://linkedin.com/in/you" maxLength={512} />
          <Field label="YouTube URL" id="youtube" type="url" value={youtubeUrl} onChange={setYoutubeUrl} placeholder="https://youtube.com/@you" maxLength={512} />
          <Field label="Instagram URL" id="instagram" type="url" value={instagramUrl} onChange={setInstagramUrl} placeholder="https://instagram.com/you" maxLength={512} />
        </div>

        <hr className="border-border" />
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Branding
        </p>

        <div className="flex items-center gap-4">
          <div className="space-y-1.5 flex-1">
            <label htmlFor="brandColor" className="text-sm font-medium">Brand Color</label>
            <div className="flex items-center gap-2">
              <input
                id="brandColor"
                type="color"
                value={brandColor}
                onChange={(e) => setBrandColor(e.target.value)}
                className="w-10 h-10 rounded-lg border border-border cursor-pointer p-0.5 bg-background"
              />
              <input
                type="text"
                value={brandColor}
                onChange={(e) => setBrandColor(e.target.value)}
                maxLength={7}
                className="w-28 px-3 py-2 rounded-lg border border-border bg-background text-sm font-mono outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
              />
            </div>
          </div>
        </div>

        {updateProfile.error && (
          <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">
            {updateProfile.error.message}
          </p>
        )}

        <button
          type="submit"
          disabled={updateProfile.isPending}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {updateProfile.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : profileSaved ? (
            <Check className="w-4 h-4" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {profileSaved ? "Saved!" : "Save Profile"}
        </button>
      </form>

      <hr className="border-border" />

      {/* Change password */}
      <form onSubmit={handlePasswordSubmit} className="space-y-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Change Password
        </p>

        <Field
          label="Current Password"
          id="currentPassword"
          type="password"
          value={currentPassword}
          onChange={setCurrentPassword}
          placeholder="••••••••"
        />
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="New Password"
            id="newPassword"
            type="password"
            value={newPassword}
            onChange={setNewPassword}
            placeholder="Min. 8 characters"
          />
          <Field
            label="Confirm New Password"
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            placeholder="Repeat new password"
          />
        </div>

        {passwordError && (
          <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{passwordError}</p>
        )}

        <button
          type="submit"
          disabled={changePassword.isPending}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {changePassword.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : passwordSaved ? (
            <Check className="w-4 h-4" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {passwordSaved ? "Password Updated!" : "Update Password"}
        </button>
      </form>
    </div>
  );
}
