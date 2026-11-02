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
  MessageCircle,
} from "lucide-react";
import { useDeferredValue, useEffect, useRef, useState, type FormEvent } from "react";
import { apiRequest, getApiErrorMessage, type UserProfile } from "@/lib/api/client";
import { MemberAvatar } from "@/components/member-avatar";

type TaskStatus = "todo" | "in_progress" | "done" | "archived";
type TaskPriority = "low" | "normal" | "high" | "urgent";
type TaskFilter = "all" | TaskStatus | "open" | "overdue";

interface OperationTask {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  assigned_user_id: string | null;
  assigned_user_name: string | null;
  assigned_user_phone: string | null;
  assigned_user_photo_url: string | null;
  created_by_name: string;
  progress_note: string | null;
  delay_reason: string | null;
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

interface TaskUpdate {
  id: string;
  user_id: string;
  user_name: string;
  status: TaskStatus | null;
  note: string | null;
  delay_reason: string | null;
  created_at: string;
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

const taskFilters: readonly [TaskFilter, string][] = [
  ["all", "Toutes"],
  ["open", "Ouvertes"],
  ["todo", "À faire"],
  ["in_progress", "En cours"],
  ["overdue", "En retard"],
  ["done", "Terminées"],
  ["archived", "Archives"],
];

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

function whatsappUrl(phone: string | null, taskTitle: string): string | null {
  const dialString = phone?.trim();
  if (!dialString || (!dialString.startsWith("+") && !dialString.startsWith("00"))) return null;
  const number = dialString.replace(/\D/g, "").replace(/^00/, "");
  if (number.length < 8 || number.length > 15) return null;
  const message = `Bonjour, comment avance la tâche « ${taskTitle} » ?`;
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

function TaskHistory({
  taskId,
  organizationId,
}: {
  taskId: string;
  organizationId: string | undefined;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const updates = useQuery({
    queryKey: ["operations", "task-updates", organizationId, taskId],
    queryFn: () => apiRequest<TaskUpdate[]>(`/operations/tasks/${taskId}/updates`, {
      headers: organizationId ? { "X-Organization-ID": organizationId } : undefined,
    }),
    enabled: isOpen && Boolean(organizationId),
    retry: false,
  });
  return (
    <details className="operations-history" onToggle={(event) => setIsOpen(event.currentTarget.open)}>
      <summary>Historique des avancements</summary>
      {updates.isError ? (
        <p className="auth-error" role="alert">{getApiErrorMessage(updates.error)}</p>
      ) : updates.isPending ? (
        <p className="operations-history-empty" role="status">Chargement de l’historique…</p>
      ) : updates.data?.length ? (
        <ol>
          {updates.data.map((update) => (
            <li key={update.id}>
              <strong>{update.user_name}</strong>
              <time dateTime={update.created_at}>
                {new Intl.DateTimeFormat("fr-FR", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                }).format(new Date(update.created_at))}
              </time>
              {update.status ? <span>{statusLabels[update.status]}</span> : null}
              {update.note ? <p>{update.note}</p> : null}
              {update.delay_reason ? (
                <p className="operations-delay-reason">
                  Justification : {update.delay_reason}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      ) : (
        <p className="operations-history-empty">Aucun compte rendu pour le moment.</p>
      )}
    </details>
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
  const [editingTask, setEditingTask] = useState<OperationTask | null>(null);
  const [summaryBucket, setSummaryBucket] = useState<"open" | "in_progress" | "overdue" | "done" | null>(null);
  const [summaryPage, setSummaryPage] = useState(1);
  const editDialogRef = useRef<HTMLDialogElement>(null);
  const summaryDialogRef = useRef<HTMLDialogElement>(null);
  const deferredSearch = useDeferredValue(search.trim());
  useEffect(() => {
    const dialog = editDialogRef.current;
    if (editingTask && dialog && !dialog.open) dialog.showModal();
  }, [editingTask]);
  useEffect(() => {
    const dialog = summaryDialogRef.current;
    if (summaryBucket && dialog && !dialog.open) dialog.showModal();
  }, [summaryBucket]);
  const profile = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => apiRequest<UserProfile>("/auth/me"),
    retry: false,
  });
  const membership = profile.data?.memberships[0];
  const organizationId = membership?.organization_id;
  const isOperator = membership?.role === "operator";
  const organizationHeaders = organizationId
    ? { "X-Organization-ID": organizationId }
    : undefined;
  const canManage = Boolean(
    membership && ["owner", "admin", "manager"].includes(membership.role),
  );

  const summary = useQuery({
    queryKey: ["operations", "summary", organizationId],
    queryFn: () =>
      apiRequest<TaskSummary>("/operations/summary", { headers: organizationHeaders }),
    enabled: Boolean(membership),
    retry: false,
    refetchInterval: 15_000,
  });
  const tasks = useQuery({
    queryKey: ["operations", "tasks", organizationId, deferredSearch, filter, page],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), page_size: "20" });
      if (deferredSearch) params.set("search", deferredSearch);
      if (filter === "open" || filter === "overdue") {
        params.set("bucket", filter);
      } else if (filter !== "all") {
        params.set("status", filter);
      }
      return apiRequest<TaskPage>(`/operations/tasks?${params}`, {
        headers: organizationHeaders,
      });
    },
    enabled: Boolean(membership),
    retry: false,
    refetchInterval: 15_000,
  });
  const summaryTasks = useQuery({
    queryKey: ["operations", "summary-tasks", organizationId, summaryBucket, summaryPage],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(summaryPage), page_size: "20" });
      if (summaryBucket === "open" || summaryBucket === "overdue") {
        params.set("bucket", summaryBucket);
      } else if (summaryBucket) {
        params.set("status", summaryBucket);
      }
      return apiRequest<TaskPage>(`/operations/tasks?${params}`, {
        headers: organizationHeaders,
      });
    },
    enabled: Boolean(membership && canManage && summaryBucket),
    retry: false,
    refetchInterval: summaryBucket ? 15_000 : false,
  });
  const members = useQuery({
    queryKey: ["operations", "members", organizationId],
    queryFn: () =>
      apiRequest<OperationMember[]>("/operations/members", {
        headers: organizationHeaders,
      }),
    enabled: Boolean(membership && canManage),
    retry: false,
    refetchInterval: 30_000,
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
      body: Partial<
        Pick<
          OperationTask,
          | "title"
          | "description"
          | "status"
          | "priority"
          | "due_date"
          | "assigned_user_id"
          | "progress_note"
          | "delay_reason"
        >
      >;
    }) => {
      if (!organizationId) throw new Error("Aucune organisation active n’est associée au compte.");
      return apiRequest<OperationTask>(`/operations/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...organizationHeaders },
        body: JSON.stringify(body),
      });
    },
    onSuccess: async () => {
      setFormError(null);
      setFormMessage(isOperator ? "Votre avancement a été transmis à l’équipe." : "La tâche a été mise à jour.");
      await refreshTasks();
    },
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

  function changeTaskFilter(nextFilter: TaskFilter) {
    setFilter(nextFilter);
    setPage(1);
  }

  function openSummaryDetails(bucket: "open" | "in_progress" | "overdue" | "done") {
    setSummaryPage(1);
    setSummaryBucket(bucket);
  }

  function handleEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingTask) return;
    const data = new FormData(event.currentTarget);
    updateTask.mutate(
      {
        id: editingTask.id,
        body: {
          title: String(data.get("title") ?? ""),
          description: String(data.get("description") ?? "").trim() || null,
          priority: data.get("priority") as TaskPriority,
          due_date: String(data.get("due_date") ?? "") || null,
          ...(members.data
            ? { assigned_user_id: String(data.get("assigned_user_id") ?? "") || null }
            : {}),
        },
      },
      {
        onSuccess: () => editDialogRef.current?.close(),
      },
    );
  }

  const taskData = tasks.data;
  const totalPages = Math.ceil((taskData?.total ?? 0) / (taskData?.page_size ?? 20));

  return (
    <div className="dashboard-content operations-page">
      <section className="page-heading" aria-labelledby="operations-title">
        <div>
          <p className="eyebrow">{isOperator ? "Votre espace de travail" : "Organisation du travail"}</p>
          <h1 className="page-title" id="operations-title">
            {isOperator ? "Mes tâches" : "Opérations"}
          </h1>
          <p className="page-description">
            {isOperator
              ? "Retrouvez vos missions, partagez votre avancement et signalez tout retard."
              : "Planifiez les activités, répartissez les responsabilités et suivez leur avancement."}
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
        {([
          {
            filter: "open",
            label: "Tâches ouvertes",
            count: summary.data?.total,
            icon: ListTodo,
            iconClass: "",
          },
          {
            filter: "in_progress",
            label: "En cours",
            count: summary.data?.in_progress,
            icon: Clock3,
            iconClass: "is-warning",
          },
          {
            filter: "overdue",
            label: "En retard",
            count: summary.data?.overdue,
            icon: AlertCircle,
            iconClass: "is-danger",
          },
          {
            filter: "done",
            label: "Terminées",
            count: summary.data?.done,
            icon: CircleCheck,
            iconClass: "is-complete",
          },
        ] as const).map(({ filter: metricFilter, label, count, icon: Icon, iconClass }) => (
          <article className="panel operations-metric" key={metricFilter}>
            <button
              className="operations-metric-button"
              type="button"
              disabled={!canManage}
              aria-label={`Ouvrir les tâches ${label.toLocaleLowerCase("fr")}`}
              onClick={() => openSummaryDetails(metricFilter)}
            >
              <span className={`operations-metric-icon ${iconClass}`}><Icon size={19} /></span>
              <span className="operations-metric-copy">
                <small>{label}</small>
                <strong>{count ?? "—"}</strong>
              </span>
            </button>
          </article>
        ))}
      </section>
      <p className="operations-live-indicator">
        <span aria-hidden="true" />
        Suivi actualisé automatiquement toutes les 15 secondes
      </p>

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
            <p className="panel-subtitle">
              {filter === "all"
                ? "Les échéances et avancements de votre équipe."
                : `${taskFilters.find(([value]) => value === filter)?.[1]} : détail des tâches correspondantes.`}
            </p>
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
            {taskFilters.map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={filter === value}
                onClick={() => changeTaskFilter(value)}
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
                  {task.assigned_user_id && organizationId ? (
                    <div className="operations-assignee">
                      <MemberAvatar
                        organizationId={organizationId}
                        userId={task.assigned_user_id}
                        name={task.assigned_user_name ?? "Collaborateur"}
                        photoUrl={task.assigned_user_photo_url}
                        className="operations-assignee-avatar"
                      />
                      <span>
                        <strong>{task.assigned_user_name}</strong>
                        <small>{isOverdue(task) ? "Échéance dépassée" : "Responsable de la tâche"}</small>
                      </span>
                      {canManage && whatsappUrl(task.assigned_user_phone, task.title) ? (
                        <a
                          className="operations-whatsapp-link"
                          href={whatsappUrl(task.assigned_user_phone, task.title) ?? undefined}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`Contacter ${task.assigned_user_name} sur WhatsApp`}
                        >
                          <MessageCircle size={15} />
                          WhatsApp
                        </a>
                      ) : null}
                    </div>
                  ) : null}
                  {task.progress_note ? (
                    <p className="operations-progress-note">
                      <strong>Dernier compte rendu :</strong> {task.progress_note}
                    </p>
                  ) : null}
                  {task.delay_reason ? (
                    <p className="operations-delay-reason">
                      <strong>Justification du retard :</strong> {task.delay_reason}
                    </p>
                  ) : null}
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
                      <button
                        className="button-secondary operations-edit-button"
                        type="button"
                        onClick={() => {
                          setFormError(null);
                          setEditingTask(task);
                        }}
                      >
                        Modifier
                      </button>
                    </>
                  ) : null}
                </div>
                {isOperator && task.status !== "done" && task.status !== "archived" ? (
                  <form
                    className="operations-progress-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const form = event.currentTarget;
                      const data = new FormData(form);
                      const note = String(data.get("progress_note") ?? "").trim();
                      const delayReason = String(data.get("delay_reason") ?? "").trim();
                      updateTask.mutate({
                        id: task.id,
                        body: {
                          status: data.get("status") as TaskStatus,
                          ...(note ? { progress_note: note } : {}),
                          ...(delayReason ? { delay_reason: delayReason } : {}),
                        },
                      }, {
                        onSuccess: () => form.reset(),
                      });
                    }}
                  >
                    <label className="auth-field">
                      <span>Mon avancement</span>
                      <select
                        defaultValue={task.status === "todo" ? "in_progress" : task.status}
                        name="status"
                      >
                        <option value="in_progress">En cours</option>
                        <option value="done">Terminée</option>
                      </select>
                    </label>
                    <label className="auth-field">
                      <span>Compte rendu</span>
                      <textarea
                        maxLength={2000}
                        name="progress_note"
                        placeholder="Décrivez le travail réalisé ou le prochain point…"
                        rows={2}
                      />
                    </label>
                    {isOverdue(task) ? (
                      <label className="auth-field operations-delay-field">
                        <span>Justification du retard (obligatoire)</span>
                        <textarea
                          maxLength={2000}
                          minLength={1}
                          name="delay_reason"
                          placeholder="Expliquez ce qui a retardé cette tâche…"
                          required
                          rows={2}
                        />
                      </label>
                    ) : null}
                    <button className="button-primary" disabled={updateTask.isPending} type="submit">
                      {updateTask.isPending ? "Envoi…" : "Envoyer mon avancement"}
                    </button>
                  </form>
                ) : null}
                <TaskHistory taskId={task.id} organizationId={organizationId} />
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
      {summaryBucket ? (
        <dialog
          aria-labelledby="operations-summary-dialog-title"
          className="parcel-edit-dialog operations-summary-dialog"
          onClose={() => setSummaryBucket(null)}
          onClick={(event) => {
            if (event.target === event.currentTarget) summaryDialogRef.current?.close();
          }}
          ref={summaryDialogRef}
        >
          <div className="parcel-edit-dialog-content">
            <div className="parcel-edit-dialog-heading">
              <div>
                <h2 id="operations-summary-dialog-title">
                  {taskFilters.find(([value]) => value === summaryBucket)?.[1]}
                </h2>
                <p>
                  {summaryTasks.data
                    ? `${summaryTasks.data.total} tâche(s) à suivre`
                    : "Détails des tâches de cette catégorie"}
                </p>
              </div>
              <button
                className="parcel-edit-dialog-close"
                type="button"
                aria-label="Fermer"
                onClick={() => summaryDialogRef.current?.close()}
              >
                ×
              </button>
            </div>
            {summaryTasks.isError ? (
              <div className="dashboard-error" role="alert">
                <p>{getApiErrorMessage(summaryTasks.error)}</p>
                <button className="button-secondary" type="button" onClick={() => void summaryTasks.refetch()}>
                  Réessayer
                </button>
              </div>
            ) : summaryTasks.isPending ? (
              <div className="dashboard-loading" role="status">Chargement des tâches…</div>
            ) : summaryTasks.data?.items.length ? (
              <div className="operations-summary-task-list">
                {summaryTasks.data.items.map((task) => (
                  <article className="operations-summary-task" key={task.id}>
                    <div className="operations-summary-task-heading">
                      <div>
                        <h3>{task.title}</h3>
                        <span className={`operations-status status-${task.status}`}>{statusLabels[task.status]}</span>
                      </div>
                      <span className={`operations-priority priority-${task.priority}`}>
                        {priorityLabels[task.priority]}
                      </span>
                    </div>
                    {task.description ? <p className="operations-task-description">{task.description}</p> : null}
                    <div className="operations-summary-task-meta">
                      <span className={isOverdue(task) ? "is-overdue" : ""}>
                        <CalendarDays size={14} />
                        {task.due_date ? formatDueDate(task.due_date) : "Sans échéance"}
                        {isOverdue(task) ? " · En retard" : ""}
                      </span>
                      <span>
                        <UserRound size={14} />
                        {task.assigned_user_name ?? "Non attribuée"}
                      </span>
                      {canManage && whatsappUrl(task.assigned_user_phone, task.title) ? (
                        <a
                          className="operations-whatsapp-link"
                          href={whatsappUrl(task.assigned_user_phone, task.title) ?? undefined}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`Contacter ${task.assigned_user_name} sur WhatsApp`}
                        >
                          <MessageCircle size={14} />
                          WhatsApp
                        </a>
                      ) : null}
                    </div>
                    {task.progress_note ? (
                      <p className="operations-progress-note">
                        <strong>Dernier avancement :</strong> {task.progress_note}
                      </p>
                    ) : null}
                    {task.delay_reason ? (
                      <p className="operations-delay-reason">
                        <strong>Justification du retard :</strong> {task.delay_reason}
                      </p>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : (
              <div className="operations-empty">
                <span><CalendarDays size={22} /></span>
                <h3>Aucune tâche dans cette catégorie</h3>
                <p>Les tâches correspondantes apparaîtront ici.</p>
              </div>
            )}
            {summaryTasks.data && summaryTasks.data.total > summaryTasks.data.page_size ? (
              <div className="sales-pagination operations-summary-pagination">
                <span>
                  {(summaryPage - 1) * summaryTasks.data.page_size + 1}–
                  {Math.min(summaryPage * summaryTasks.data.page_size, summaryTasks.data.total)}
                  {" "}sur {summaryTasks.data.total}
                </span>
                <div>
                  <button
                    className="pagination-button"
                    type="button"
                    aria-label="Page précédente"
                    disabled={summaryPage <= 1}
                    onClick={() => setSummaryPage((current) => Math.max(current - 1, 1))}
                  >
                    ‹
                  </button>
                  <span>
                    Page {summaryPage} / {Math.ceil(summaryTasks.data.total / summaryTasks.data.page_size)}
                  </span>
                  <button
                    className="pagination-button"
                    type="button"
                    aria-label="Page suivante"
                    disabled={summaryPage >= Math.ceil(summaryTasks.data.total / summaryTasks.data.page_size)}
                    onClick={() => setSummaryPage((current) => current + 1)}
                  >
                    ›
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </dialog>
      ) : null}
      {editingTask ? (
        <dialog
          aria-labelledby="operations-edit-title"
          className="parcel-edit-dialog operations-edit-dialog"
          onClose={() => setEditingTask(null)}
          onClick={(event) => {
            if (event.target === event.currentTarget) editDialogRef.current?.close();
          }}
          ref={editDialogRef}
        >
          <div className="parcel-edit-dialog-content">
            <div className="parcel-edit-dialog-heading">
              <div>
                <h2 id="operations-edit-title">Modifier la tâche</h2>
                <p>{editingTask.title}</p>
              </div>
              <button
                className="parcel-edit-dialog-close"
                type="button"
                aria-label="Fermer"
                onClick={() => editDialogRef.current?.close()}
              >
                ×
              </button>
            </div>
            {updateTask.isError ? (
              <p className="auth-error" role="alert">{getApiErrorMessage(updateTask.error)}</p>
            ) : null}
            <form
              key={editingTask.id}
              className="operations-edit-form operations-edit-dialog-form"
              onSubmit={handleEdit}
            >
              <label className="auth-field">
                <span>Intitulé</span>
                <input defaultValue={editingTask.title} maxLength={160} minLength={2} name="title" required />
              </label>
              <label className="auth-field">
                <span>Description</span>
                <textarea defaultValue={editingTask.description ?? ""} maxLength={2000} name="description" rows={3} />
              </label>
              <label className="auth-field">
                <span>Échéance</span>
                <input defaultValue={editingTask.due_date ?? ""} name="due_date" type="date" />
              </label>
              <label className="auth-field">
                <span>Priorité</span>
                <select defaultValue={editingTask.priority} name="priority">
                  {Object.entries(priorityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label className="auth-field">
                <span>Responsable</span>
                <select
                  defaultValue={editingTask.assigned_user_id ?? ""}
                  disabled={members.isPending || members.isError}
                  name="assigned_user_id"
                >
                  <option value="">Non attribuée</option>
                  {(members.data ?? []).map((member) => <option key={member.id} value={member.id}>{member.full_name}</option>)}
                </select>
              </label>
              {members.isError ? (
                <p className="auth-error" role="alert">{getApiErrorMessage(members.error)}</p>
              ) : null}
              <div className="parcel-edit-dialog-actions">
                <button className="button-secondary" type="button" onClick={() => editDialogRef.current?.close()}>
                  Annuler
                </button>
                <button className="button-primary" disabled={updateTask.isPending} type="submit">
                  {updateTask.isPending ? "Enregistrement…" : "Enregistrer"}
                </button>
              </div>
            </form>
          </div>
        </dialog>
      ) : null}
    </div>
  );
}
