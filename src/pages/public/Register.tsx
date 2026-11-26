import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import { Check, MailCheck } from "lucide-react";
import { api, errorMessage } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { makeLookup } from "../../lib/directory";
import type { Gender, LeaderLevel } from "../../lib/types";
import { Alert, Modal, SelectInput, Spinner, TextInput } from "../../components/ui";
import { policies } from "../../lib/policies";
import { PolicySections } from "./Policies";
import { useSeo } from "../../lib/seo";
import { checkEmail } from "../../lib/emailCheck";

type Form = {
  full_name: string;
  email: string;
  confirm_email: string;
  password: string;
  confirm: string;
  phone: string;
  gender: Gender | "";
  association_id: string;
  county_id: string;
  institution_id: string;
  course: string;
  admission_year: string;
  year_of_study: string;
  /** Graduated already: registering as alumni. */
  completed: boolean;
  expected_completion_year: string;
  leader_level: LeaderLevel | "";
  leader_position: string;
  accept: boolean;
};

const steps = ["Your account", "Your campus", "Leadership", "Confirm"];
const thisYear = new Date().getFullYear();

const blank: Form = {
  full_name: "",
  email: "",
  confirm_email: "",
  password: "",
  confirm: "",
  phone: "",
  gender: "",
  association_id: "",
  county_id: "",
  institution_id: "",
  course: "",
  admission_year: String(thisYear),
  year_of_study: "1",
  completed: false,
  expected_completion_year: String(thisYear + 4),
  leader_level: "",
  leader_position: "",
  accept: false,
};

/** Opens a policy in a pop-up so the form stays filled in. */
function PolicyLink({ slug, onOpen, children }: { slug: string; onOpen: (slug: string) => void; children: ReactNode }) {
  return (
    <a
      href={`/policies/${slug}`}
      onClick={(e) => {
        e.preventDefault();
        onOpen(slug);
      }}
      className="font-semibold"
    >
      {children}
    </a>
  );
}

export function RegisterPage() {
  const { me, directory } = useAuth();
  const navigate = useNavigate();
  const lookup = makeLookup(directory);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  /** The member said "No, mine is correct" for this exact address. */
  const [keptEmail, setKeptEmail] = useState<string | null>(null);
  const [reading, setReading] = useState<string | null>(null);
  // Nothing is saved: refreshing or leaving the page starts the form again. (Policies open in a pop-up, so reading them keeps it.)
  const [f, setF] = useState<Form>(blank);
  useEffect(() => {
    try {
      sessionStorage.removeItem("msak-register-draft"); // clear drafts saved by the earlier version
    } catch {
      /* ignore */
    }
  }, []);

  useSeo({
    title: "Become a member",
    description: "Join MSAK: register as a Messianic student at your university or college in Kenya and get announcements from your campus, region and the national office.",
    path: "/register",
  });
  useEffect(() => {
    if (me && !sentTo) navigate("/app", { replace: true });
  }, [me, sentTo, navigate]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setF((prev) => ({ ...prev, [k]: v }));
    setErrors((prev) => ({ ...prev, [k]: undefined }));
  };

  const counties = useMemo(() => lookup.countiesOf(Number(f.association_id) || null), [lookup, f.association_id]);
  const institutions = useMemo(() => lookup.institutionsOf(Number(f.county_id) || null), [lookup, f.county_id]);

  function validate(i: number): boolean {
    const e: Partial<Record<keyof Form, string>> = {};
    if (i === 0) {
      if (f.full_name.trim().length < 2) e.full_name = "Enter your full name.";
      const mail = checkEmail(f.email);
      if (!mail.ok) e.email = mail.error;
      else if (mail.suggestion && keptEmail !== f.email.trim()) e.email = `Check your email: did you mean ${mail.suggestion}?`;
      if (mail.ok && f.confirm_email.trim().toLowerCase() !== f.email.trim().toLowerCase()) e.confirm_email = "The two email addresses don't match.";
      if (f.password.length < 8) e.password = "Use at least 8 characters.";
      if (f.confirm !== f.password) e.confirm = "The passwords don't match.";
      const digits = f.phone.replace(/\D/g, "");
      if (!/^\+?[0-9 ()-]{7,24}$/.test(f.phone.trim()) || digits.length < 9 || digits.length > 15) e.phone = "Enter a phone number, e.g. 0712 345 678.";
      if (!f.gender) e.gender = "Choose one.";
    }
    if (i === 1) {
      if (!f.association_id) e.association_id = "Choose your association.";
      if (!f.county_id) e.county_id = "Choose your county.";
      if (!f.institution_id) e.institution_id = "Choose your institution.";
      if (f.course.trim().length < 2) e.course = "Enter your course.";
      const adm = Number(f.admission_year);
      const yos = Number(f.year_of_study);
      const done = Number(f.expected_completion_year);
      if (!(adm >= 1990 && adm <= thisYear + 1)) e.admission_year = `Between 1990 and ${thisYear + 1}.`;
      if (!f.completed && !(yos >= 1 && yos <= 10)) e.year_of_study = "Between 1 and 10.";
      if (!(done >= adm && done <= adm + 12)) e.expected_completion_year = "Must be after your admission year.";
      else if (f.completed && done > thisYear) e.expected_completion_year = `If you've completed your studies, this is ${thisYear} or earlier.`;
      else if (!f.completed && done < thisYear) e.expected_completion_year = "That's in the past — choose “I've completed my studies” above if you've graduated.";
    }
    if (i === 2 && f.leader_level && f.leader_position.trim().length < 2) e.leader_position = "Enter your position, e.g. Chairperson.";
    if (i === 3 && !f.accept) e.accept = "Please accept the terms to continue.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  // alumni see three steps (no Leadership); step 3 (Confirm) shows as the third
  const shownSteps = f.completed ? steps.filter((x) => x !== "Leadership") : steps;
  const pos = f.completed && step === 3 ? 2 : step;

  function next(e: FormEvent) {
    e.preventDefault();
    if (!validate(step)) return;
    if (step < steps.length - 1) {
      // alumni skip the Leadership step: they join as members and add past positions later
      setStep(step === 1 && f.completed ? 3 : step + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    void submit();
  }

  async function submit() {
    setBusy(true);
    setSubmitError(null);
    try {
      const res = await api.signUp({
        email: f.email.trim(),
        password: f.password,
        full_name: f.full_name.trim(),
        gender: f.gender as Gender,
        phone: f.phone.trim(),
        institution_id: Number(f.institution_id),
        course: f.course.trim(),
        admission_year: Number(f.admission_year),
        // alumni: their final year of study
        year_of_study: f.completed
          ? Math.min(10, Math.max(1, Number(f.expected_completion_year) - Number(f.admission_year) || 1))
          : Number(f.year_of_study),
        expected_completion_year: Number(f.expected_completion_year),
        leader_level: (!f.completed && f.leader_level) || null,
        leader_position: !f.completed && f.leader_level ? f.leader_position.trim() : null,
      });
      if (res.needsConfirmation) setSentTo(f.email.trim());
      else navigate("/app", { replace: true });
    } catch (err) {
      setSubmitError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (sentTo) {
    return (
      <div className="container-page flex max-w-xl flex-col items-start gap-4 py-20">
        <MailCheck className="size-12 text-gold-700" aria-hidden="true" />
        <h1 className="font-serif text-4xl font-semibold text-navy-900">Check your email</h1>
        <p className="text-[17px] leading-relaxed text-body">
          We sent a confirmation link to <strong>{sentTo}</strong>. Open it on this device to activate your account, then log in.
        </p>
        <Link to="/login" className="btn btn-primary">
          Go to login
        </Link>
      </div>
    );
  }

  if (!directory) return <Spinner label="Loading the association directory…" />;

  const inst = lookup.institution(Number(f.institution_id));
  const assoc = lookup.association(Number(f.association_id));

  return (
    <div className="container-page max-w-2xl py-10 lg:py-14">
      <p className="eyebrow mb-1">Become a member</p>
      <h1 className="font-serif text-3xl font-semibold text-navy-900 sm:text-4xl">Join the fellowship</h1>
      <p className="mt-2 text-[15px] text-body">
        Already a member? <Link to="/login">Log in</Link>.
      </p>

      <ol className={`mt-8 grid gap-2 ${f.completed ? "grid-cols-3" : "grid-cols-4"}`} aria-label="Registration steps">
        {shownSteps.map((s, i) => (
          <li key={s} className="flex flex-col gap-2" aria-current={i === pos ? "step" : undefined}>
            <span className={`h-1 rounded-full ${i <= pos ? "bg-navy-900" : "bg-line"}`} />
            <span className={`text-xs sm:text-[13px] ${i === pos ? "font-bold text-navy-900" : "text-muted"}`}>
              {i < pos && <Check className="mr-1 inline size-3.5" aria-hidden="true" />}
              {s}
            </span>
          </li>
        ))}
      </ol>

      <form onSubmit={next} noValidate className="card mt-6 flex flex-col gap-5 p-5 sm:p-8">
        <h2 className="font-serif text-2xl font-semibold text-navy-900">
          {pos + 1}. {steps[step]}
        </h2>

        {step === 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <TextInput label="Full name" value={f.full_name} onChange={(e) => set("full_name", e.target.value)} error={errors.full_name} autoComplete="name" />
            </div>
            <div className="sm:col-span-2">
              <TextInput
                label="Email"
                type="email"
                inputMode="email"
                value={f.email}
                onChange={(e) => set("email", e.target.value)}
                error={errors.email}
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                hint="Use an address you check — it's how you reset your password."
              />
              {(() => {
                const mail = checkEmail(f.email);
                if (!f.email.includes("@") || !mail.ok || !mail.suggestion || keptEmail === f.email.trim()) return null;
                const fixed = mail.suggestion;
                return (
                  <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md bg-gold-50 px-3 py-2 text-sm text-navy-900" role="status">
                    <span>
                      Did you mean <strong className="break-all">{fixed}</strong>?
                    </span>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => {
                        setF((prev) => ({
                          ...prev,
                          email: fixed,
                          confirm_email: prev.confirm_email.trim().toLowerCase() === prev.email.trim().toLowerCase() ? fixed : prev.confirm_email,
                        }));
                        setErrors((prev) => ({ ...prev, email: undefined, confirm_email: undefined }));
                      }}
                    >
                      Yes, use this
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => {
                        setKeptEmail(f.email.trim());
                        setErrors((prev) => ({ ...prev, email: undefined }));
                      }}
                    >
                      No, mine is correct
                    </button>
                  </div>
                );
              })()}
            </div>
            <div className="sm:col-span-2">
              <TextInput
                label="Confirm email"
                type="email"
                inputMode="email"
                value={f.confirm_email}
                onChange={(e) => set("confirm_email", e.target.value)}
                onPaste={(e) => e.preventDefault()}
                error={errors.confirm_email}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                hint="Type it again (not pasted) to catch mistakes."
              />
            </div>
            <TextInput label="Password" type="password" value={f.password} onChange={(e) => set("password", e.target.value)} error={errors.password} autoComplete="new-password" hint="At least 8 characters." />
            <TextInput label="Confirm password" type="password" value={f.confirm} onChange={(e) => set("confirm", e.target.value)} error={errors.confirm} autoComplete="new-password" />
            <TextInput label="Phone" type="tel" inputMode="tel" value={f.phone} onChange={(e) => set("phone", e.target.value)} error={errors.phone} autoComplete="tel" placeholder="07XX XXX XXX" />
            <fieldset>
              <legend className="field-label">Gender</legend>
              <div className="flex gap-2">
                {(["Male", "Female"] as const).map((g) => (
                  <label key={g} className={`btn flex-1 ${f.gender === g ? "btn-primary" : "btn-outline"}`}>
                    <input type="radio" name="gender" value={g} checked={f.gender === g} onChange={() => set("gender", g)} className="sr-only" />
                    {g}
                  </label>
                ))}
              </div>
              {errors.gender && <p className="field-error">{errors.gender}</p>}
            </fieldset>
          </div>
        )}

        {step === 1 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <SelectInput
                label="Association"
                value={f.association_id}
                error={errors.association_id}
                onChange={(e) => {
                  set("association_id", e.target.value);
                  set("county_id", "");
                  set("institution_id", "");
                }}
              >
                <option value="">Choose your association</option>
                {lookup.associations.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} — {a.name}
                  </option>
                ))}
              </SelectInput>
            </div>
            <SelectInput
              label="County"
              value={f.county_id}
              error={errors.county_id}
              disabled={!f.association_id}
              onChange={(e) => {
                set("county_id", e.target.value);
                set("institution_id", "");
              }}
            >
              <option value="">Choose county</option>
              {counties.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </SelectInput>
            <SelectInput
              label="Institution"
              value={f.institution_id}
              error={errors.institution_id}
              disabled={!f.county_id}
              onChange={(e) => set("institution_id", e.target.value)}
              hint="Not listed? Choose the closest and tell us in Help & feedback after you join."
            >
              <option value="">Choose institution</option>
              {institutions.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </SelectInput>
            <fieldset className="sm:col-span-2">
              <legend className="field-label">Are you still studying?</legend>
              <div className="mt-1 grid gap-2 sm:grid-cols-2">
                {(
                  [
                    [false, "I'm still studying"],
                    [true, "I've completed my studies (alumni)"],
                  ] as const
                ).map(([value, label]) => (
                  <label
                    key={label}
                    className={`flex cursor-pointer items-center gap-3 rounded-md border px-3 py-3 text-sm font-semibold ${
                      f.completed === value ? "border-navy-900 bg-navy-900/5 text-navy-900" : "border-line text-body"
                    }`}
                  >
                    <input
                      type="radio"
                      name="completed"
                      className="size-4 accent-[#0B1F4D]"
                      checked={f.completed === value}
                      onChange={() => {
                        set("completed", value);
                        setErrors((prev) => ({ ...prev, expected_completion_year: undefined, year_of_study: undefined }));
                        if (value && Number(f.expected_completion_year) > thisYear) set("expected_completion_year", String(thisYear - 1));
                        if (!value && Number(f.expected_completion_year) < thisYear) set("expected_completion_year", String(thisYear + 1));
                      }}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="sm:col-span-2">
              <TextInput label="Course" value={f.course} onChange={(e) => set("course", e.target.value)} error={errors.course} placeholder="e.g. BSc Computer Science" />
            </div>
            <TextInput
              label="Year of admission"
              type="number"
              inputMode="numeric"
              value={f.admission_year}
              onChange={(e) => set("admission_year", e.target.value)}
              error={errors.admission_year}
            />
            {!f.completed && (
              <TextInput
                label="Current year of study"
                type="number"
                inputMode="numeric"
                min={1}
                max={10}
                value={f.year_of_study}
                onChange={(e) => set("year_of_study", e.target.value)}
                error={errors.year_of_study}
              />
            )}
            <TextInput
              label={f.completed ? "Year you completed" : "Expected completion year"}
              type="number"
              inputMode="numeric"
              value={f.expected_completion_year}
              onChange={(e) => set("expected_completion_year", e.target.value)}
              error={errors.expected_completion_year}
              hint={
                f.completed
                  ? "You'll join as alumni. After signing up you can add any leadership positions you held."
                  : "Used to welcome you into the alumni community later."
              }
            />
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-4">
            <p className="text-[15px] leading-relaxed text-body">
              Do you hold a leadership position? Your request is checked before you can post: campus leaders are verified by your regional
              leaders; regional and national leaders by an MSAK administrator.
            </p>
            <div className="grid gap-2" role="radiogroup" aria-label="Leadership">
              {(
                [
                  ["", "No, I'm a member", "Most people choose this."],
                  ["institutional", "Institutional leader", `Post to members at ${inst?.name ?? "your institution"}.`],
                  ["regional", "Regional leader", `Post to all of ${assoc?.code ?? "your association"}; verify campus leaders.`],
                  ["national", "National leader", "Post to all MSAK members."],
                ] as const
              ).map(([v, label, note]) => (
                <label
                  key={v || "none"}
                  className={`flex cursor-pointer items-start gap-3 rounded-md border p-4 ${f.leader_level === v ? "border-2 border-navy-900 bg-navy-50" : "border-line-strong bg-white"}`}
                >
                  <input type="radio" name="leader" className="mt-1 size-4 accent-[#0B1F4D]" checked={f.leader_level === v} onChange={() => set("leader_level", v)} />
                  <span>
                    <span className="block font-semibold text-navy-900">{label}</span>
                    <span className="block text-sm text-muted">{note}</span>
                  </span>
                </label>
              ))}
            </div>
            {f.leader_level && (
              <TextInput
                label="Your position"
                value={f.leader_position}
                onChange={(e) => set("leader_position", e.target.value)}
                error={errors.leader_position}
                placeholder="e.g. Chairperson, Secretary, Treasurer"
                maxLength={100}
              />
            )}
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-4">
            <dl className="grid gap-x-6 gap-y-3 rounded-md bg-paper p-4 text-sm sm:grid-cols-[160px_1fr]">
              <dt className="text-muted">Name</dt>
              <dd className="font-semibold">{f.full_name}</dd>
              <dt className="text-muted">Email</dt>
              <dd className="font-semibold break-all">{f.email}</dd>
              <dt className="text-muted">Phone</dt>
              <dd className="font-semibold">{f.phone}</dd>
              <dt className="text-muted">Campus</dt>
              <dd className="font-semibold">{lookup.placeLabel(Number(f.institution_id))}</dd>
              <dt className="text-muted">Course</dt>
              <dd className="font-semibold">
                {f.completed ? `${f.course} · completed ${f.expected_completion_year} (alumni)` : `${f.course} · Year ${f.year_of_study} · completing ${f.expected_completion_year}`}
              </dd>
              <dt className="text-muted">Leadership</dt>
              <dd className="font-semibold">
                {f.completed ? "Alumni member" : f.leader_level ? `${f.leader_position} (${f.leader_level}) — to be verified` : "Member"}
              </dd>
            </dl>
            <label className="flex items-start gap-3 text-sm leading-relaxed">
              <input type="checkbox" className="mt-0.5 size-5 accent-[#0B1F4D]" checked={f.accept} onChange={(e) => set("accept", e.target.checked)} />
              <span>
                I agree to the{" "}
                <PolicyLink slug="terms" onOpen={setReading}>
                  Terms
                </PolicyLink>
                ,{" "}
                <PolicyLink slug="privacy" onOpen={setReading}>
                  Privacy Policy
                </PolicyLink>{" "}
                and{" "}
                <PolicyLink slug="community" onOpen={setReading}>
                  Community Standards
                </PolicyLink>
                .
              </span>
            </label>
            {errors.accept && <p className="field-error">{errors.accept}</p>}
          </div>
        )}

        {submitError && <Alert tone="error">{submitError}</Alert>}

        <div className="flex justify-between gap-2 border-t border-line pt-5">
          {step > 0 ? (
            <button type="button" className="btn btn-outline" onClick={() => setStep(step === 3 && f.completed ? 1 : step - 1)} disabled={busy}>
              Back
            </button>
          ) : (
            <span />
          )}
          <button type="submit" className={`btn ${step === steps.length - 1 ? "btn-gold" : "btn-primary"}`} disabled={busy}>
            {step === steps.length - 1 ? (busy ? "Creating your account…" : "Create my account") : "Continue"}
          </button>
        </div>
      </form>

      {/* Policies open over the form, so nothing typed is lost */}
      <Modal open={!!reading} wide title={reading && policies[reading] ? policies[reading].title : "Policy"} onClose={() => setReading(null)}>
        {reading && policies[reading] && (
          <div className="max-h-[65vh] overflow-y-auto pr-1">
            <p className="text-sm text-muted">{policies[reading].description}</p>
            <PolicySections doc={policies[reading]} compact />
            <div className="sticky bottom-0 mt-6 flex justify-end bg-white pt-3">
              <button type="button" className="btn btn-primary" onClick={() => setReading(null)}>
                Back to registration
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
