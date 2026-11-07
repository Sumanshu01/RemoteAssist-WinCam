import React, { useState } from "react";
import {
  FileText,
  CheckCircle2,
  Circle,
  AlertTriangle,
  RefreshCw,
  Save,
  ShieldAlert,
  Clock
} from "lucide-react";
import { ApplicationWorkflow, WorkflowChecklistItem } from "@remoteassist/shared-types";

interface ApplicationWorkflowEditorProps {
  initialWorkflow?: ApplicationWorkflow;
  applicantName?: string;
  applicantCountry?: string;
}

export const ApplicationWorkflowEditor: React.FC<ApplicationWorkflowEditorProps> = ({
  initialWorkflow = {
    id: "wf_demo_001",
    applicantId: "usr_applicant_001",
    version: 1,
    status: "IN_PROGRESS",
    dataJson: {
      intendedProvince: "Ontario",
      nocCode: "21211",
      yearsExperience: 8,
      notes: "Assisting applicant with remote technical portfolio and credentials check."
    },
    disclaimer:
      "Local application assistance draft saved. This is NOT submitted to any external hiring, visa, or government portal.",
    checklists: [
      {
        id: "chk_1",
        workflowId: "wf_demo_001",
        label: "Verify Educational Credential Assessment (ECA) report",
        isCompleted: true,
        sortOrder: 1,
        completedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: "chk_2",
        workflowId: "wf_demo_001",
        label: "Prepare Proof of Funds and Financial Statements",
        isCompleted: false,
        sortOrder: 2,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: "chk_3",
        workflowId: "wf_demo_001",
        label: "Review RemoteAssist WinCam video verification with Canadian Specialist",
        isCompleted: false,
        sortOrder: 3,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ],
    lastSavedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  applicantName = "Rohan Sharma (Applicant)",
  applicantCountry = "India (IN)"
}) => {
  const [workflow, setWorkflow] = useState<ApplicationWorkflow>(initialWorkflow);
  const [saveStatus, setSaveStatus] = useState<"saved" | "pending" | "failed" | "conflict">(
    "saved"
  );
  const [notes, setNotes] = useState<string>((initialWorkflow.dataJson.notes as string) || "");
  const [province, setProvince] = useState<string>(
    (initialWorkflow.dataJson.intendedProvince as string) || "Ontario"
  );
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Immediate save with optimistic concurrency check
  const handleSave = (
    newNotes?: string,
    newProvince?: string,
    newChecklists?: WorkflowChecklistItem[]
  ) => {
    setSaveStatus("pending");
    setStatusMessage("Saving draft to local database...");

    const updatedData = {
      ...workflow.dataJson,
      notes: newNotes !== undefined ? newNotes : notes,
      intendedProvince: newProvince !== undefined ? newProvince : province
    };

    const updatedChecklists = newChecklists || workflow.checklists;

    setTimeout(() => {
      // Successful persistence increments optimistic version
      const nextVersion = workflow.version + 1;
      const updated: ApplicationWorkflow = {
        ...workflow,
        version: nextVersion,
        dataJson: updatedData,
        checklists: updatedChecklists,
        lastSavedAt: new Date().toISOString()
      };
      setWorkflow(updated);
      setSaveStatus("saved");
      setStatusMessage(`Saved draft locally (Version ${nextVersion})`);
      setTimeout(() => setStatusMessage(null), 3500);
    }, 600);
  };

  const toggleChecklist = (id: string) => {
    const updated = workflow.checklists.map((c) =>
      c.id === id
        ? {
            ...c,
            isCompleted: !c.isCompleted,
            completedAt: !c.isCompleted ? new Date().toISOString() : undefined
          }
        : c
    );
    setWorkflow({ ...workflow, checklists: updated });
    handleSave(notes, province, updated);
  };

  // Simulate an optimistic concurrency conflict (e.g. server modified concurrently)
  const handleSimulateConflict = () => {
    setSaveStatus("conflict");
    setStatusMessage(
      `Concurrency Collision: Server is at version ${workflow.version + 2}. Another helper modified this record.`
    );
  };

  // Bounded retry resolution
  const handleRetry = () => {
    setSaveStatus("pending");
    setStatusMessage("Fetching latest server state and reconciling changes (Attempt 1 of 3)...");
    setTimeout(() => {
      const reconciledVersion = workflow.version + 3;
      setWorkflow({
        ...workflow,
        version: reconciledVersion,
        lastSavedAt: new Date().toISOString()
      });
      setSaveStatus("saved");
      setStatusMessage(
        `Conflict resolved! Re-synchronized with server at version ${reconciledVersion}.`
      );
      setTimeout(() => setStatusMessage(null), 3500);
    }, 700);
  };

  return (
    <div
      className="glass-card p-6 border-slate-200"
      role="region"
      aria-label="Application Progress & Workflow Persistence"
    >
      {/* Title & Status Indicator */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 text-sm">
              Application Progress & Checklist (Local State)
            </h3>
            <p className="text-xs text-slate-500">
              Candidate: <strong className="text-slate-800">{applicantName}</strong> • Origin:{" "}
              {applicantCountry}
            </p>
          </div>
        </div>

        {/* Real-time Save Status Badge */}
        <div className="flex items-center gap-2">
          {saveStatus === "saved" && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Saved (v{workflow.version})
            </span>
          )}

          {saveStatus === "pending" && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              Saving...
            </span>
          )}

          {saveStatus === "conflict" && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-300">
              <AlertTriangle className="w-3.5 h-3.5" />
              Version Conflict
            </span>
          )}

          {saveStatus === "failed" && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
              <ShieldAlert className="w-3.5 h-3.5" />
              Save Failed
            </span>
          )}
        </div>
      </div>

      {/* Mandatory Ethical & Legal Disclaimer Banner */}
      <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3 my-4 flex items-start gap-2.5 text-xs text-amber-950">
        <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="leading-tight">
          <span className="font-bold">Notice & Transparency Guarantee:</span> {workflow.disclaimer}
        </div>
      </div>

      {statusMessage && (
        <div className="mb-4 text-xs font-medium text-slate-700 bg-slate-100 p-2.5 rounded-lg border border-slate-200 flex items-center justify-between">
          <span>{statusMessage}</span>
          {saveStatus === "conflict" && (
            <button
              onClick={handleRetry}
              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded text-[11px] ml-2"
            >
              Resolve & Retry Sync
            </button>
          )}
        </div>
      )}

      {/* Form Fields for Application Draft */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Target Canadian Province
          </label>
          <select
            value={province}
            onChange={(e) => {
              setProvince(e.target.value);
              handleSave(notes, e.target.value);
            }}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:bg-white"
          >
            <option value="Ontario">Ontario (Toronto / Ottawa)</option>
            <option value="British Columbia">British Columbia (Vancouver)</option>
            <option value="Alberta">Alberta (Calgary / Edmonton)</option>
            <option value="Quebec">Quebec (Montreal)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Assistance Notes & Review Points
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => handleSave(notes, province)}
            placeholder="Notes from video assist session..."
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:bg-white"
          />
        </div>
      </div>

      {/* Checklist Items */}
      <div className="space-y-2 mb-5">
        <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider block mb-2">
          Preparation Checklist Items
        </span>

        {workflow.checklists.map((item) => (
          <div
            key={item.id}
            onClick={() => toggleChecklist(item.id)}
            className={`p-3 rounded-lg border text-xs flex items-center justify-between cursor-pointer transition-all ${
              item.isCompleted
                ? "bg-emerald-50/50 border-emerald-200 text-slate-800"
                : "bg-slate-50/70 border-slate-200 text-slate-600 hover:bg-slate-100"
            }`}
          >
            <div className="flex items-center gap-2.5">
              {item.isCompleted ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              ) : (
                <Circle className="w-4 h-4 text-slate-400 flex-shrink-0" />
              )}
              <span
                className={
                  item.isCompleted ? "line-through text-slate-500 font-medium" : "font-medium"
                }
              >
                {item.label}
              </span>
            </div>
            {item.completedAt && (
              <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
                Verified
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Persistence Test Controls */}
      <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-1.5 text-slate-500">
          <Clock className="w-3.5 h-3.5" />
          <span>Last local save: {new Date(workflow.lastSavedAt).toLocaleTimeString()}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleSave(notes, province)}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center gap-1.5 transition"
          >
            <Save className="w-3.5 h-3.5" />
            Save Now
          </button>

          <button
            onClick={handleSimulateConflict}
            className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-lg font-medium transition"
            title="Simulate concurrent update from remote helper"
          >
            Test Concurrency Collision
          </button>
        </div>
      </div>
    </div>
  );
};
