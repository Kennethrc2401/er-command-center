"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { UserPlus, UserCog, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const ROLE_OPTIONS = ["ADMIN", "DOCTOR", "NURSE", "CCMA"] as const;
const STATUS_OPTIONS = ["ACTIVE", "INACTIVE"] as const;

type UserRole = (typeof ROLE_OPTIONS)[number];
type UserStatus = (typeof STATUS_OPTIONS)[number];

type UserFormState = {
  name: string;
  email: string;
  role: UserRole;
  credentials: string;
  department: string;
  status: UserStatus;
  npiNumber: string;
};

const EMPTY_FORM: UserFormState = {
  name: "",
  email: "",
  role: "DOCTOR",
  credentials: "",
  department: "",
  status: "ACTIVE",
  npiNumber: "",
};

const formFromUser = (user: Doc<"users">): UserFormState => ({
  name: user.name,
  email: user.email,
  role: user.role,
  credentials: user.credentials,
  department: user.department,
  status: user.status,
  npiNumber: user.npiNumber ?? "",
});

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  return "Unexpected error. Please try again.";
};

export default function ClinicianDirectory() {
  const users = useQuery(api.users.listAll);
  const createUser = useMutation(api.users.createUser);
  const updateUser = useMutation(api.users.updateUser);
  const deleteUser = useMutation(api.users.deleteUser);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [createPending, setCreatePending] = useState(false);
  const [editPending, setEditPending] = useState(false);
  const [deletingId, setDeletingId] = useState<Id<"users"> | null>(null);
  const [editingUserId, setEditingUserId] = useState<Id<"users"> | null>(null);
  const [createForm, setCreateForm] = useState<UserFormState>(EMPTY_FORM);
  const [editForm, setEditForm] = useState<UserFormState>(EMPTY_FORM);

  const handleCreateSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreatePending(true);
    try {
      await createUser({
        name: createForm.name.trim(),
        email: createForm.email.trim(),
        role: createForm.role,
        credentials: createForm.credentials.trim(),
        department: createForm.department.trim(),
        npiNumber: createForm.npiNumber.trim() || undefined,
      });
      toast.success("User created.");
      setCreateForm(EMPTY_FORM);
      setIsCreateOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setCreatePending(false);
    }
  };

  const openEditDialog = (user: Doc<"users">) => {
    setEditingUserId(user._id);
    setEditForm(formFromUser(user));
    setIsEditOpen(true);
  };

  const handleEditSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingUserId) return;

    setEditPending(true);
    try {
      await updateUser({
        id: editingUserId,
        name: editForm.name.trim(),
        email: editForm.email.trim(),
        role: editForm.role,
        credentials: editForm.credentials.trim(),
        department: editForm.department.trim(),
        status: editForm.status,
        npiNumber: editForm.npiNumber.trim() || undefined,
      });
      toast.success("User updated.");
      setIsEditOpen(false);
      setEditingUserId(null);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setEditPending(false);
    }
  };

  const handleDelete = async (user: Doc<"users">) => {
    const confirmed = window.confirm(`Delete ${user.name}? This cannot be undone.`);
    if (!confirmed) return;

    setDeletingId(user._id);
    try {
      await deleteUser({ id: user._id });
      toast.success("User deleted.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
      <header className="flex items-center justify-between bg-slate-900 p-8 text-white">
        <div>
          <h2 className="text-xl font-black uppercase italic tracking-tight">Staff Management</h2>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">Enterprise Access Control</p>
        </div>

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <button className="rounded-2xl bg-blue-600 p-3 transition-all hover:bg-blue-500" aria-label="Create clinician user">
              <UserPlus className="h-5 w-5" />
            </button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-lg font-black uppercase tracking-tight">Create Clinician User</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateSubmit} className="space-y-4 pt-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="new-name">Full Name</Label>
                  <Input
                    id="new-name"
                    value={createForm.name}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, name: e.target.value }))}
                    required
                    disabled={createPending}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="new-email">Email</Label>
                  <Input
                    id="new-email"
                    type="email"
                    value={createForm.email}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, email: e.target.value }))}
                    required
                    disabled={createPending}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="new-role">Role</Label>
                  <select
                    id="new-role"
                    value={createForm.role}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, role: e.target.value as UserRole }))}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    disabled={createPending}
                  >
                    {ROLE_OPTIONS.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="new-credentials">Credentials</Label>
                  <Input
                    id="new-credentials"
                    placeholder="RN, BSN"
                    value={createForm.credentials}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, credentials: e.target.value }))}
                    required
                    disabled={createPending}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="new-department">Department</Label>
                  <Input
                    id="new-department"
                    value={createForm.department}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, department: e.target.value }))}
                    required
                    disabled={createPending}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="new-npi">NPI Number (Optional)</Label>
                  <Input
                    id="new-npi"
                    value={createForm.npiNumber}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, npiNumber: e.target.value }))}
                    disabled={createPending}
                  />
                </div>
              </div>

              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={createPending}>
                {createPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating User...
                  </>
                ) : (
                  "Create User"
                )}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-50 bg-slate-50/50">
              <th className="p-6 text-[10px] font-black uppercase text-slate-400">Clinician</th>
              <th className="p-6 text-[10px] font-black uppercase text-slate-400">Role</th>
              <th className="p-6 text-[10px] font-black uppercase text-slate-400">Department</th>
              <th className="p-6 text-[10px] font-black uppercase text-slate-400">Status</th>
              <th className="p-6 text-[10px] font-black uppercase text-slate-400 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {users?.map((user) => (
              <tr key={user._id} className="group transition-all hover:bg-slate-50">
                <td className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 font-black text-slate-400 transition-all group-hover:bg-blue-100 group-hover:text-blue-600">
                      {user.name[0]}
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-900">{user.name}, {user.credentials}</p>
                      <p className="text-[10px] font-medium text-slate-400">{user.email}</p>
                    </div>
                  </div>
                </td>
                <td className="p-6">
                  <span
                    className={`rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-widest ${
                      user.role === "ADMIN" ? "bg-purple-50 text-purple-600" : "bg-blue-50 text-blue-600"
                    }`}
                  >
                    {user.role}
                  </span>
                </td>
                <td className="p-6 text-xs font-bold text-slate-600">{user.department}</td>
                <td className="p-6">
                  <Badge
                    variant="outline"
                    className={`text-[9px] font-black uppercase tracking-widest ${
                      user.status === "ACTIVE"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-slate-200 bg-slate-100 text-slate-500"
                    }`}
                  >
                    {user.status}
                  </Badge>
                </td>
                <td className="p-6 text-right">
                  <div className="inline-flex items-center gap-2">
                    <button
                      onClick={() => openEditDialog(user)}
                      className="p-2 text-slate-300 transition-colors hover:text-blue-600"
                      aria-label={`Edit ${user.name}`}
                    >
                      <UserCog className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(user)}
                      className="p-2 text-slate-300 transition-colors hover:text-red-600"
                      aria-label={`Delete ${user.name}`}
                      disabled={deletingId === user._id}
                    >
                      {deletingId === user._id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {users && users.length === 0 && (
              <tr>
                <td colSpan={5} className="p-10 text-center text-xs font-bold uppercase tracking-widest text-slate-400">
                  No clinicians found. Use the + button to create the first user.
                </td>
              </tr>
            )}

            {!users && (
              <tr>
                <td colSpan={5} className="p-10 text-center text-xs font-bold uppercase tracking-widest text-slate-400">
                  Loading directory...
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog
        open={isEditOpen}
        onOpenChange={(open) => {
          setIsEditOpen(open);
          if (!open) setEditingUserId(null);
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black uppercase tracking-tight">Update Clinician User</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4 pt-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="edit-name">Full Name</Label>
                <Input
                  id="edit-name"
                  value={editForm.name}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                  required
                  disabled={editPending}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, email: e.target.value }))}
                  required
                  disabled={editPending}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-role">Role</Label>
                <select
                  id="edit-role"
                  value={editForm.role}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, role: e.target.value as UserRole }))}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  disabled={editPending}
                >
                  {ROLE_OPTIONS.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-status">Status</Label>
                <select
                  id="edit-status"
                  value={editForm.status}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, status: e.target.value as UserStatus }))}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  disabled={editPending}
                >
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-credentials">Credentials</Label>
                <Input
                  id="edit-credentials"
                  value={editForm.credentials}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, credentials: e.target.value }))}
                  required
                  disabled={editPending}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-department">Department</Label>
                <Input
                  id="edit-department"
                  value={editForm.department}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, department: e.target.value }))}
                  required
                  disabled={editPending}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="edit-npi">NPI Number (Optional)</Label>
                <Input
                  id="edit-npi"
                  value={editForm.npiNumber}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, npiNumber: e.target.value }))}
                  disabled={editPending}
                />
              </div>
            </div>

            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={editPending || !editingUserId}>
              {editPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating User...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
