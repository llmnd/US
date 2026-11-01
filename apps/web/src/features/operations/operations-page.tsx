"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CalendarDays,
  Check,
  CircleCheck,
  Clock3,
  ListTodo,
  Plus,
  Search,
  UserRound,
} from "lucide-react";
import { useDeferredValue, useState, type FormEvent } from "react";
import { apiRequest, getApiErrorMessage, type UserProfile } from "@/lib/api/client";

type TaskStatus = "todo" | "in_progress" | "done" | "archived";
type TaskPriority = "low" | "normal" | "high" | "urgent";
type TaskFilter = "all" | TaskStatus;

interface OperationTask {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  assigned_user_id: string | null;
  assigned_user_name: string | null;
  created_by_name: string;
  created_at: string;
  updated_at: string;
}

interface TaskPage {
  items: OperationTask[];
  total: number;
  page: number;
  page_size: number;
}

interface TaskSummary {
  total: number;
  todo: number;
  in_progress: number;
  done: number;
  overdue: number;
  due_soon: number;
}

interface OperationMember {
  id: string;
  username: string;
  full_name: string;
}

const statusLabels: Record<TaskStatus, string> = {
  todo: "À faire",
  in_progress: "En cours",
  done: "Terminée",
  archived: "Archivée",
};

const priorityLabels: Record<TaskPriority, string> = {
  low: "Basse",
  normal: "Normale",
  high: "Haute",
  urgent: "Urgente",
};

function localDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDueDate(value: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

function isOverdue(task: OperationTask): boolean {
  return Boolean(
    task.due_date &&
      task.due_date < localDateInput(new Date()) &&
      task.status !== "done" &&
      task.status !== "archived",
  );
}

export function OperationsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<TaskFilter>("all");
  const [page, setPage] = useState(1);
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const deferredSearch = useDeferredValue(search.trim());
  const profile = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => apiRequest<UserProfile>("/auth/me"),
    retry: false,
  });
  const membership = profile.data?.memberships[0];
  const organizationId = membership?.organization_id;
  const organizationHeaders = organizationId
    ? { "X-Organization-ID": organizationId }
    : undefined;
  const canManage = Boolean(membership && membership.role !== "reader");

  const summary = useQuery({
    queryKey: ["operations", "summary", organizationId],
    queryFn: () =>
      apiRequest<TaskSummary>("/operations/summary", { headers: organizationHeaders }),
    enabled: Boolean(membership),
    retry: false,
  });
  const tasks = useQuery({
    queryKey: ["operations", "tasks", organizationId, deferredSearch, filter, page],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), page_size: "20" });
      if (deferredSearch) params.set("search", deferredSearch);
      if (filter !== "all") params.set("status", filter);
      return apiRequest<TaskPage>(`/operations/tasks?${params}`, {
        headers: organizationHeaders,
      });
    },
    enabled: Boolean(membership),
    retry: false,
  });
  const members = useQuery({
    queryKey: ["operations", "members", organizationId],
    queryFn: () =>
      apiRequest<OperationMember[]>("/operations/members", {
        headers: organizationHeaders,
      }),
    enabled: Boolean(membership && canManage),
    retry: false,
  });

  async function refreshTasks() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["operations", "tasks"] }),
      queryClient.invalidateQueries({ queryKey: ["operations", "summary"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard", "overview"] }),
    ]);
  }

  const createTask = useMutation({
    mutationFn: (body: {
      title: string;
      description: string | null;
      priority: TaskPriority;
      due_date: string | null;
      assigned_user_id: string | null;
    }) => {
      if (!organizationId) throw new Error("Aucune organisation active n’est associée au compte.");
      return apiRequest<OperationTask>("/operations/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...organizationHeaders },
        body: JSON.stringify(body),
      });
    },
    onSuccess: async (task) => {
      setFormMessage(`Tâche « ${task.title} » créée.`);
      setFormError(null);
      setPage(1);
      setShowCreateForm(false);
      await refreshTasks();
    },
    onError: (error) => {
      setFormMessage(null);
      setFormError(getApiErrorMessage(error));
    },
  });
  const updateTask = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: Partial<Pick<OperationTask, "title" | "description" | "status" | "priority" | "due_date" | "assigned_user_id">>;
    }) => {
      if (!organizationId) throw new Error("Aucune organisation active n’est associée au compte.");
      return apiRequest<OperationTask>(`/operations/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...organizationHeaders },
        body: JSON.stringify(body),
      });
    },
    onSuccess: refreshTasks,
  });

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormMessage(null);
    setFormError(null);
    const data = new FormData(event.currentTarget);
    const form = event.currentTarget;
    createTask.mutate({
      title: String(data.get("title") ?? ""),
      description: String(data.get("description") ?? "").trim() || null,
      priority: (data.get("priority") as TaskPriority) || "normal",
      due_date: String(data.get("due_date") ?? "") || null,
      assigned_user_id: members.data
        ? String(data.get("assigned_user_id") ?? "") || null
        : null,
    }, {
      onSuccess: () => form.reset(),
    });
  }

  const taskData = tasks.data;
  const totalPages = Math.ceil((taskData?.total ?? 0) / (taskData?.page_size ?? 20));

  return (
    <div className="dashboard-content operations-page">
      <section className="page-heading" aria-labelledby="operations-title">
        <div>
          <p className="eyebrow">Organisation du travail</p>
          <h1 className="page-title" id="operations-title">Opérations</h1>
          <p className="page-description">
            Planifiez les activités, répartissez les responsabilités et suivez leur avancement.
          </p>
        </div>
        {canManage ? (
          <button
            className="button-primary"
            type="button"
            onClick={() => {
              setShowCreateForm((open) => !open);
              setFormError(null);
              setFormMessage(null);
            }}
          >
            <Plus size={16} />
            Nouvelle tâche
          </button>
        ) : null}
      </section>

      <section className="operations-metrics" aria-label="Résumé des tâches">
        <article className="panel operations-metric">
          <span className="operations-metric-icon"><ListTodo size={17} /></span>
          <span className="operations-metric-copy"><small>Tâches ouvertes</small><strong>{summary.data?.total ?? "—"}</strong></span>
        </article>
        <article className="panel operations-metric">
          <span className="operations-metric-icon is-warning"><Clock3 size={17} /></span>
          <span className="operations-metric-copy"><small>En cours</small><strong>{summary.data?.in_progress ?? "—"}</strong></span>
        </article>
        <article className="panel operations-metric">
          <span className="operations-metric-icon is-danger"><AlertCircle size={17} /></span>
          <span className="operations-metric-copy"><small>En retard</small><strong>{summary.data?.overdue ?? "—"}</strong></span>
        </article>
        <article className="panel operations-metric">
          <span className="operations-metric-icon is-complete"><CircleCheck size={17} /></span>
          <span className="operations-metric-copy"><small>Terminées</small><strong>{summary.data?.done ?? "—"}</strong></span>
        </article>
      </section>

      {summary.isError ? (
        <div className="dashboard-error" role="alert">
          <p>{getApiErrorMessage(summary.error)}</p>
          <button className="button-secondary" type="button" onClick={() => void summary.refetch()}>
            Réessayer
          </button>
        </div>
      ) : null}
      {members.isError ? (
        <div className="dashboard-error" role="alert">
          <p>{getApiErrorMessage(members.error)}</p>
          <button className="button-secondary" type="button" onClick={() => void members.refetch()}>
            Réessayer
          </button>
        </div>
      ) : null}

      {showCreateForm && canManage ? (
        <section className="panel operations-create-panel" aria-labelledby="create-task-title">
          <div className="panel-header">
            <div>
              <h2 className="panel-title" id="create-task-title">Ajouter une tâche</h2>
              <p className="panel-subtitle">Définissez une échéance et un responsable si nécessaire.</p>
            </div>
          </div>
          <form className="operations-form" onSubmit={handleCreate}>
            <label className="auth-field operations-title-field">
              <span>Intitulé</span>
              <input autoFocus maxLength={160} minLength={2} name="title" placeholder="Ex. Préparer la livraison de la semaine" required />
            </label>
            <label className="auth-field">
              <span>Échéance</span>
              <input name="due_date" type="date" />
            </label>
            <label className="auth-field">
              <span>Priorité</span>
              <select defaultValue="normal" name="priority">
                {Object.entries(priorityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="auth-field">
              <span>Responsable</span>
              <select defaultValue="" disabled={members.isPending || members.isError} name="assigned_user_id">
                <option value="">Non attribuée</option>
                {(members.data ?? []).map((member) => <option key={member.id} value={member.id}>{member.full_name}</option>)}
              </select>
            </label>
            <label className="auth-field operations-description-field">
              <span>Description</span>
              <textarea maxLength={2000} name="description" placeholder="Précisions utiles pour l’équipe…" rows={2} />
            </label>
            <div className="operations-form-actions">
              <button className="button-secondary" type="button" onClick={() => setShowCreateForm(false)}>Annuler</button>
              <button className="button-primary" disabled={createTask.isPending} type="submit">
                {createTask.isPending ? "Création…" : "Créer la tâche"}
              </button>
            </div>
            {formError ? <p className="auth-error" role="alert">{formError}</p> : null}
          </form>
        </section>
      ) : null}
      {formMessage ? <p className="admin-success" role="status">{formMessage}</p> : null}
      {formError && !showCreateForm ? <p className="auth-error" role="alert">{formError}</p> : null}
      {updateTask.isError ? <p className="auth-error" role="alert">{getApiErrorMessage(updateTask.error)}</p> : null}

      <section className="panel operations-list-panel" aria-labelledby="task-list-title">
        <div className="operations-list-header">
          <div>
            <h2 className="panel-title" id="task-list-title">Planning des activités</h2>
            <p className="panel-subtitle">Les échéances et avancements de votre équipe.</p>
          </div>
          <label className="sales-search">
            <Search size={15} aria-hidden="true" />
            <span className="visually-hidden">Rechercher une tâche</span>
            <input
              type="search"
              value={search}
              placeholder="Rechercher une tâche"
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </label>
        </div>
        <div className="operations-filter-row">
          <div className="segmented-control operations-filters" role="group" aria-label="Filtrer les tâches">
            {([
              ["all", "Toutes"],
              ["todo", "À faire"],
              ["in_progress", "En cours"],
              ["done", "Terminées"],
              ["archived", "Archives"],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={filter === value}
                onClick={() => {
                  setFilter(value);
                  setPage(1);
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <span className="operations-count">{taskData?.total ?? 0} tâche(s)</span>
        </div>

        {tasks.isError ? (
          <div className="dashboard-error" role="alert">
            <p>{getApiErrorMessage(tasks.error)}</p>
            <button className="button-secondary" type="button" onClick={() => void tasks.refetch()}>
              Réessayer
            </button>
          </div>
        ) : tasks.isPending ? (
          <div className="dashboard-loading" role="status">Chargement du planning…</div>
        ) : taskData?.items.length ? (
          <div className="operations-task-list">
            {taskData.items.map((task) => (
              <article className={`operations-task ${task.status === "done" ? "is-done" : ""}`} key={task.id}>
                <div className="operations-task-marker" aria-hidden="true">
                  {task.status === "done" ? <Check size={15} /> : <span />}
                </div>
                <div className="operations-task-main">
                  <div className="operations-task-title-row">
                    <h3>{task.title}</h3>
                    <span className={`operations-priority priority-${task.priority}`}>{priorityLabels[task.priority]}</span>
                  </div>
                  {task.description ? <p className="operations-task-description">{task.description}</p> : null}
                  <div className="operations-task-meta">
                    <span className={isOverdue(task) ? "is-overdue" : ""}>
                      <CalendarDays size={13} />
                      {task.due_date ? formatDueDate(task.due_date) : "Sans échéance"}
                    </span>
                    <span><UserRound size={13} />{task.assigned_user_name ?? "Non attribuée"}</span>
                  </div>
                </div>
                <div className="operations-task-actions">
                  <span className={`operations-status status-${task.status}`}>{statusLabels[task.status]}</span>
                  {canManage ? (
                    <>
                      <label className="visually-hidden" htmlFor={`task-status-${task.id}`}>Avancement : {task.title}</label>
                      <select
                        id={`task-status-${task.id}`}
                        className="operations-status-select"
                        value={task.status}
                        disabled={updateTask.isPending}
                        onChange={(event) => updateTask.mutate({
                          id: task.id,
                          body: { status: event.currentTarget.value as TaskStatus },
                        })}
                      >
                        {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </select>
                      <details className="operations-edit">
                        <summary aria-label={`Modifier ${task.title}`}>Modifier</summary>
                        <form
                          className="operations-edit-form"
                          onSubmit={(event) => {
                            event.preventDefault();
                            const form = event.currentTarget;
                            const data = new FormData(form);
                            updateTask.mutate({
                              id: task.id,
                              body: {
                                title: String(data.get("title") ?? ""),
                                description: String(data.get("description") ?? "").trim() || null,
                                priority: data.get("priority") as TaskPriority,
                                due_date: String(data.get("due_date") ?? "") || null,
                                ...(members.data
                                  ? {
                                      assigned_user_id:
                                        String(data.get("assigned_user_id") ?? "") || null,
                                    }
                                  : {}),
                              },
                            }, {
                              onSuccess: () => form.closest("details")?.removeAttribute("open"),
                            });
                          }}
                        >
                          <label className="auth-field"><span>Intitulé</span><input defaultValue={task.title} maxLength={160} minLength={2} name="title" required /></label>
                          <label className="auth-field"><span>Description</span><textarea defaultValue={task.description ?? ""} maxLength={2000} name="description" rows={2} /></label>
                          <label className="auth-field"><span>Échéance</span><input defaultValue={task.due_date ?? ""} name="due_date" type="date" /></label>
                          <label className="auth-field"><span>Priorité</span><select defaultValue={task.priority} name="priority">{Object.entries(priorityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                          <label className="auth-field"><span>Responsable</span><select defaultValue={task.assigned_user_id ?? ""} disabled={members.isPending || members.isError} name="assigned_user_id"><option value="">Non attribuée</option>{(members.data ?? []).map((member) => <option key={member.id} value={member.id}>{member.full_name}</option>)}</select></label>
                          <button className="button-primary" disabled={updateTask.isPending} type="submit">{updateTask.isPending ? "Enregistrement…" : "Enregistrer"}</button>
                        </form>
                      </details>
                    </>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="operations-empty">
            <span><CalendarDays size={22} /></span>
            <h3>{filter === "all" ? "Aucune activité planifiée" : "Aucune tâche pour ce filtre"}</h3>
            <p>
              {filter === "all"
                ? "Créez une tâche avec une échéance et un responsable pour organiser le travail de l’équipe."
                : "Les tâches correspondantes apparaîtront ici."}
            </p>
            {canManage && filter === "all" ? (
              <button className="button-primary" type="button" onClick={() => setShowCreateForm(true)}>
                <Plus size={15} />Créer la première tâche
              </button>
            ) : null}
          </div>
        )}

        {taskData && totalPages > 1 ? (
          <div className="sales-pagination">
            <span>{(page - 1) * taskData.page_size + 1}–{Math.min(page * taskData.page_size, taskData.total)} sur {taskData.total}</span>
            <div>
              <button className="pagination-button" type="button" aria-label="Page précédente" disabled={page <= 1} onClick={() => setPage(Math.max(page - 1, 1))}>‹</button>
              <span>Page {page} / {totalPages}</span>
              <button className="pagination-button" type="button" aria-label="Page suivante" disabled={page >= totalPages} onClick={() => setPage(Math.min(page + 1, totalPages))}>›</button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
