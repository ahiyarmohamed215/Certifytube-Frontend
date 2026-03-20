import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Eye, Pencil, Search, Trash2, UserCheck, UserX } from "lucide-react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";

import { deleteUser, getAdminLearners, setAdminUserActive, updateAdminUser } from "../../api/admin";
import { getApiMessage } from "../../api/errors";
import { useAuthStore } from "../../store/useAuthStore";
import type { AdminUser } from "../../types/api";
import { formatIsoDate } from "./engagementReview";

type LearnerFilter = "all" | "active" | "inactive";

type EditFormState = {
  name: string;
  email: string;
  role: string;
  active: boolean;
  emailVerified: boolean;
};

function AdminAccessDenied() {
  const nav = useNavigate();
  return (
    <div className="ct-empty" style={{ minHeight: 300 }}>
      <div className="ct-empty-icon">Admin</div>
      <p>Access denied. Admin role required.</p>
      <button className="ct-btn ct-btn-primary" onClick={() => nav(-1)} style={{ marginTop: 16 }}>
        Go Back
      </button>
    </div>
  );
}

function emptyEditForm(learner: AdminUser | null): EditFormState {
  return {
    name: learner?.name?.trim() || "",
    email: learner?.email || "",
    role: learner?.role || "LEARNER",
    active: learner?.active !== false,
    emailVerified: Boolean(learner?.emailVerified),
  };
}

function updateLearnerList(data: AdminUser[] | undefined, learnerId: number, patch: Partial<AdminUser>): AdminUser[] | undefined {
  if (!data) return data;
  return data.map((learner) => (
    learner.userId === learnerId
      ? { ...learner, ...patch }
      : learner
  ));
}

export function AdminLearnersPage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<LearnerFilter>("all");
  const [editTarget, setEditTarget] = useState<AdminUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [editForm, setEditForm] = useState<EditFormState>(emptyEditForm(null));

  const isAdmin = user?.role === "ADMIN";

  const learnersQuery = useQuery({
    queryKey: ["admin-learners"],
    queryFn: getAdminLearners,
    enabled: isAdmin,
    staleTime: 60_000,
  });

  const setLearnerCaches = (updater: (prev: AdminUser[] | undefined) => AdminUser[] | undefined) => {
    qc.setQueryData<AdminUser[] | undefined>(["admin-learners"], updater);
    qc.setQueryData<AdminUser[] | undefined>(["admin-users"], updater);
  };

  const toggleMutation = useMutation({
    mutationFn: ({ learnerId, active }: { learnerId: number; active: boolean }) => setAdminUserActive(learnerId, active),
    onMutate: async ({ learnerId, active }) => {
      await qc.cancelQueries({ queryKey: ["admin-learners"] });
      const previousLearners = qc.getQueryData<AdminUser[]>(["admin-learners"]);
      const previousUsers = qc.getQueryData<AdminUser[]>(["admin-users"]);
      setLearnerCaches((prev) => updateLearnerList(prev, learnerId, { active }));
      return { previousLearners, previousUsers };
    },
    onError: (error, _vars, context) => {
      qc.setQueryData(["admin-learners"], context?.previousLearners);
      qc.setQueryData(["admin-users"], context?.previousUsers);
      toast.error(getApiMessage(error, "Failed to update learner status"));
    },
    onSuccess: (updatedLearner) => {
      setLearnerCaches((prev) => updateLearnerList(prev, updatedLearner.userId, updatedLearner));
      qc.setQueryData(["admin-learner-profile", updatedLearner.userId, 30], (prev: any) => {
        if (!prev) return prev;
        return { ...prev, learner: { ...prev.learner, ...updatedLearner } };
      });
      toast.success(updatedLearner.active === false ? "Learner deactivated" : "Learner activated");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["admin-learners"] });
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ learnerId, payload }: { learnerId: number; payload: EditFormState }) => updateAdminUser(learnerId, payload),
    onMutate: async ({ learnerId, payload }) => {
      await qc.cancelQueries({ queryKey: ["admin-learners"] });
      const previousLearners = qc.getQueryData<AdminUser[]>(["admin-learners"]);
      const previousUsers = qc.getQueryData<AdminUser[]>(["admin-users"]);
      setLearnerCaches((prev) => updateLearnerList(prev, learnerId, payload));
      return { previousLearners, previousUsers };
    },
    onError: (error, _vars, context) => {
      qc.setQueryData(["admin-learners"], context?.previousLearners);
      qc.setQueryData(["admin-users"], context?.previousUsers);
      toast.error(getApiMessage(error, "Failed to update learner"));
    },
    onSuccess: (updatedLearner) => {
      setLearnerCaches((prev) => updateLearnerList(prev, updatedLearner.userId, updatedLearner));
      qc.setQueryData(["admin-learner-profile", updatedLearner.userId, 30], (prev: any) => {
        if (!prev) return prev;
        return { ...prev, learner: { ...prev.learner, ...updatedLearner } };
      });
      setEditTarget(null);
      toast.success("Learner updated successfully");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["admin-learners"] });
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (learnerId: number) => deleteUser(learnerId),
    onMutate: async (learnerId) => {
      await qc.cancelQueries({ queryKey: ["admin-learners"] });
      const previousLearners = qc.getQueryData<AdminUser[]>(["admin-learners"]);
      const previousUsers = qc.getQueryData<AdminUser[]>(["admin-users"]);
      setLearnerCaches((prev) => prev?.filter((learner) => learner.userId !== learnerId));
      return { previousLearners, previousUsers };
    },
    onError: (error, _vars, context) => {
      qc.setQueryData(["admin-learners"], context?.previousLearners);
      qc.setQueryData(["admin-users"], context?.previousUsers);
      toast.error(getApiMessage(error, "Failed to delete learner"));
    },
    onSuccess: (_data, learnerId) => {
      setDeleteTarget(null);
      qc.removeQueries({ queryKey: ["admin-learner-profile", learnerId, 30] });
      toast.success("Learner deleted successfully");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["admin-learners"] });
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });

  const learners = learnersQuery.data || [];

  const filteredLearners = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    return learners.filter((learner) => {
      const active = learner.active !== false;
      if (filter === "active" && !active) return false;
      if (filter === "inactive" && active) return false;
      if (!search) return true;
      const haystack = `${learner.name || ""} ${learner.email || ""}`.toLowerCase();
      return haystack.includes(search);
    });
  }, [filter, learners, searchTerm]);

  const stats = useMemo(() => {
    const total = learners.length;
    const active = learners.filter((learner) => learner.active !== false).length;
    const verified = learners.filter((learner) => learner.emailVerified).length;
    const certificates = learners.reduce((sum, learner) => sum + Number(learner.certificateCount || 0), 0);
    return { total, active, verified, certificates };
  }, [learners]);

  const modalOpen = Boolean(editTarget || deleteTarget);

  useEffect(() => {
    if (!modalOpen) return;
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, [modalOpen]);

  if (!isAdmin) {
    return <AdminAccessDenied />;
  }

  const openEditModal = (learner: AdminUser) => {
    setEditTarget(learner);
    setEditForm(emptyEditForm(learner));
  };

  const closeEditModal = () => {
    if (updateMutation.isPending) return;
    setEditTarget(null);
    setEditForm(emptyEditForm(null));
  };

  const closeDeleteModal = () => {
    if (deleteMutation.isPending) return;
    setDeleteTarget(null);
  };

  const submitEdit = () => {
    if (!editTarget || updateMutation.isPending) return;
    updateMutation.mutate({
      learnerId: editTarget.userId,
      payload: {
        name: editForm.name.trim(),
        email: editForm.email.trim(),
        role: editForm.role,
        active: editForm.active,
        emailVerified: editForm.emailVerified,
      },
    });
  };

  return (
    <div className="ct-slide-up ct-admin-engagement-page">
      <div className="ct-admin-module-header">
        <div>
          <div className="ct-admin-module-kicker">Admin Only</div>
          <h1 className="ct-page-title">Learners</h1>
          <p className="ct-page-subtitle">Manage learner accounts, access, and learner-level activity.</p>
        </div>
        <div className="ct-admin-module-actions">
          <button className="ct-btn ct-btn-secondary" onClick={() => nav("/admin")}>
            <ArrowLeft size={14} />
            Back to Admin
          </button>
        </div>
      </div>

      <div className="ct-admin-metric-grid">
        <div className="ct-admin-metric-card">
          <span className="ct-admin-metric-label">Learners</span>
          <strong className="ct-admin-metric-value">{stats.total}</strong>
          <span className="ct-admin-metric-note">Total learner accounts</span>
        </div>
        <div className="ct-admin-metric-card">
          <span className="ct-admin-metric-label">Active</span>
          <strong className="ct-admin-metric-value">{stats.active}</strong>
          <span className="ct-admin-metric-note">Currently allowed to use the platform</span>
        </div>
        <div className="ct-admin-metric-card">
          <span className="ct-admin-metric-label">Email Verified</span>
          <strong className="ct-admin-metric-value">{stats.verified}</strong>
          <span className="ct-admin-metric-note">Verified learner identities</span>
        </div>
        <div className="ct-admin-metric-card">
          <span className="ct-admin-metric-label">Certificates</span>
          <strong className="ct-admin-metric-value">{stats.certificates}</strong>
          <span className="ct-admin-metric-note">Certificates across all learners</span>
        </div>
      </div>

      <section className="ct-admin-panel-card">
        <div className="ct-admin-panel-head">
          <div>
            <h2 className="ct-admin-panel-title">Learners List</h2>
            <p className="ct-admin-panel-subtitle">
              Search by learner name or email, then open the full learner profile or update account access.
            </p>
          </div>
        </div>

        <div className="ct-admin-filter-row">
          <label className="ct-admin-search">
            <Search size={15} />
            <input
              className="ct-input"
              type="search"
              placeholder="Search learner name or email"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </label>
          <select className="ct-select" value={filter} onChange={(event) => setFilter(event.target.value as LearnerFilter)}>
            <option value="all">All learners</option>
            <option value="active">Active only</option>
            <option value="inactive">Inactive only</option>
          </select>
          <div className="ct-admin-filter-summary">{filteredLearners.length} visible</div>
        </div>

        {learnersQuery.isLoading ? (
          <div className="ct-admin-skeleton-stack">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="ct-admin-skeleton-row" />
            ))}
          </div>
        ) : filteredLearners.length === 0 ? (
          <div className="ct-empty" style={{ minHeight: 180 }}>
            <div className="ct-empty-icon">0</div>
            <p>No learners matched the current filters.</p>
          </div>
        ) : (
          <div className="ct-table-wrap">
            <table className="ct-table ct-admin-learners-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Status</th>
                  <th>Role</th>
                  <th>Sessions</th>
                  <th>Certificates</th>
                  <th>Created</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filteredLearners.map((learner) => {
                  const active = learner.active !== false;
                  const toggling = toggleMutation.isPending && toggleMutation.variables?.learnerId === learner.userId;
                  return (
                    <tr key={learner.userId}>
                      <td>
                        <div className="ct-admin-table-primary">{learner.name?.trim() || "Unnamed learner"}</div>
                        <div className="ct-admin-table-secondary">{learner.email}</div>
                        <div className="ct-admin-table-secondary">ID {learner.userId}</div>
                      </td>
                      <td>
                        <div className="ct-admin-badge-row" style={{ justifyContent: "flex-start" }}>
                          <span className={`ct-admin-chip ${active ? "is-good" : "is-bad"}`}>
                            {active ? "Active" : "Inactive"}
                          </span>
                          <span className={`ct-admin-chip ${learner.emailVerified ? "is-good" : "is-neutral"}`}>
                            {learner.emailVerified ? "Verified" : "Unverified"}
                          </span>
                        </div>
                      </td>
                      <td>{learner.role}</td>
                      <td>{learner.sessionCount ?? 0}</td>
                      <td>{learner.certificateCount ?? 0}</td>
                      <td>{formatIsoDate(learner.createdAtUtc || null)}</td>
                      <td>
                        <div className="ct-admin-inline-actions">
                          <button className="ct-btn ct-btn-secondary ct-btn-sm" onClick={() => nav(`/admin/learners/${learner.userId}`)}>
                            <Eye size={14} />
                            View
                          </button>
                          <button className="ct-btn ct-btn-secondary ct-btn-sm" onClick={() => openEditModal(learner)}>
                            <Pencil size={14} />
                            Edit
                          </button>
                          <button
                            className={`ct-btn ct-btn-sm ${active ? "ct-btn-warning" : "ct-btn-primary"}`}
                            onClick={() => toggleMutation.mutate({ learnerId: learner.userId, active: !active })}
                            disabled={toggling}
                          >
                            {active ? <UserX size={14} /> : <UserCheck size={14} />}
                            {toggling ? "Updating..." : active ? "Deactivate" : "Activate"}
                          </button>
                          <button className="ct-btn ct-btn-danger ct-btn-sm" onClick={() => setDeleteTarget(learner)}>
                            <Trash2 size={14} />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editTarget && createPortal(
        <div className="ct-modal-backdrop" onClick={closeEditModal}>
          <div className="ct-modal-card ct-admin-edit-modal" onClick={(event) => event.stopPropagation()}>
            <h3 className="ct-delete-modal-title">Edit Learner</h3>
            <p className="ct-delete-modal-text">Update learner identity and access state.</p>

            <div className="ct-admin-modal-form">
              <label>
                <span className="ct-form-label">Name</span>
                <input
                  className="ct-input"
                  value={editForm.name}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))}
                  disabled={updateMutation.isPending}
                />
              </label>
              <label>
                <span className="ct-form-label">Email</span>
                <input
                  className="ct-input"
                  type="email"
                  value={editForm.email}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, email: event.target.value }))}
                  disabled={updateMutation.isPending}
                />
              </label>
              <label>
                <span className="ct-form-label">Role</span>
                <select
                  className="ct-select"
                  value={editForm.role}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, role: event.target.value }))}
                  disabled={updateMutation.isPending}
                >
                  <option value="LEARNER">LEARNER</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </label>
              <label>
                <span className="ct-form-label">Active</span>
                <select
                  className="ct-select"
                  value={editForm.active ? "true" : "false"}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, active: event.target.value === "true" }))}
                  disabled={updateMutation.isPending}
                >
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </label>
              <label>
                <span className="ct-form-label">Email Verified</span>
                <select
                  className="ct-select"
                  value={editForm.emailVerified ? "true" : "false"}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, emailVerified: event.target.value === "true" }))}
                  disabled={updateMutation.isPending}
                >
                  <option value="true">Verified</option>
                  <option value="false">Not verified</option>
                </select>
              </label>
            </div>

            <div className="ct-modal-actions" style={{ marginTop: 18 }}>
              <button className="ct-btn ct-btn-secondary" onClick={closeEditModal} disabled={updateMutation.isPending}>
                Cancel
              </button>
              <button className="ct-btn ct-btn-primary" onClick={submitEdit} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {deleteTarget && createPortal(
        <div className="ct-modal-backdrop" onClick={closeDeleteModal}>
          <div className="ct-modal-card ct-delete-modal" onClick={(event) => event.stopPropagation()}>
            <div className="ct-delete-modal-icon">
              <Trash2 size={22} />
            </div>
            <h3 className="ct-delete-modal-title">Delete Learner?</h3>
            <p className="ct-delete-modal-text">
              This will permanently remove the learner account and all owned sessions, quizzes, engagement results, and certificates.
            </p>
            <p className="ct-delete-modal-subtext">
              <strong>{deleteTarget.name?.trim() || deleteTarget.email}</strong>
            </p>
            <div className="ct-admin-warning-grid">
              <div><span>Sessions</span><strong>{deleteTarget.sessionCount ?? 0}</strong></div>
              <div><span>Certificates</span><strong>{deleteTarget.certificateCount ?? 0}</strong></div>
            </div>
            <div className="ct-modal-actions" style={{ marginTop: 16 }}>
              <button className="ct-btn ct-btn-secondary" onClick={closeDeleteModal} disabled={deleteMutation.isPending}>
                Cancel
              </button>
              <button
                className="ct-btn ct-btn-danger"
                onClick={() => deleteMutation.mutate(deleteTarget.userId)}
                disabled={deleteMutation.isPending}
              >
                <Trash2 size={15} />
                {deleteMutation.isPending ? "Deleting..." : "Delete Learner"}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
