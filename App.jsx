import { useMemo, useRef, useState } from 'react';
import { generatePackage } from './generatePackage';
import './style.css';

const MAX_FILES = 30;
const MAX_TOTAL_BYTES = 50 * 1024 * 1024;

const text = {
  en: {
    eyebrow: 'TENDER WORKSPACE', title: 'Tender Document Package Builder', subtitle: 'Prepare and review your submission documents.',
    language: 'বাংলা', loadRequirements: 'Load requirements.json', tenderDetails: 'Tender details', tenderId: 'Tender ID',
    procuringEntity: 'Procuring entity', bidder: 'Bidder', deadline: 'Submission deadline', requirements: 'Requirements',
    documents: 'documents', upload: 'Upload PDF documents', uploadHint: 'Up to 30 PDFs and 50 MB total. Identical contents are detected.',
    choosePdfs: 'Choose PDFs', matching: 'Match uploaded PDF', chooseFile: '— Select a file —', expiryDate: 'Expiry date',
    status: 'Status', mandatory: 'Mandatory', optional: 'Optional', autoMatch: 'Auto-Match', generate: 'Generate Package',
    generating: 'Generating…', remove: 'Remove', file: 'File', pages: 'pages', duplicate: 'Duplicate',
    emptyTitle: 'Load a requirements file to get started', emptyBody: 'Choose requirements.json to see the tender details and document checklist.',
    invalidJson: 'Could not read that file. Please choose a valid JSON file.',
    invalidShape: 'The file must contain a tender object and a requirements array.',
    nonPdf: 'Non-PDF files were rejected.',
    badPdf: 'File is damaged or password protected',
    fileLimit: 'The upload limit is 30 files.', sizeLimit: 'The total upload size cannot exceed 50 MB.',
    fileTooLarge: 'This file would exceed the 50 MB total upload limit.',
    readerError: 'The PDF reader could not be loaded. Please refresh and try again.',
    readError: 'Could not read this file.', uploadFailed: 'Could not process the selected files.',
    duplicateBlock: 'Identical PDF contents cannot be matched to different requirements.',
    matchMissing: 'Missing', expiryNeeded: 'Expiry date needed', expired: 'Expired', notProvided: 'Not provided', ok: 'OK',
    noRequirements: 'No requirements were provided in this file.',
  },
  bn: {
    eyebrow: 'টেন্ডার ওয়ার্কস্পেস', title: 'টেন্ডার ডকুমেন্ট প্যাকেজ বিল্ডার', subtitle: 'জমা দেওয়ার নথি তৈরি ও যাচাই করুন।',
    language: 'English', loadRequirements: 'requirements.json লোড করুন', tenderDetails: 'টেন্ডারের বিবরণ', tenderId: 'টেন্ডার আইডি',
    procuringEntity: 'ক্রয়কারী সংস্থা', bidder: 'দরদাতা', deadline: 'জমা দেওয়ার শেষ তারিখ', requirements: 'প্রয়োজনীয় কাগজপত্র',
    documents: 'টি কাগজপত্র', upload: 'PDF নথি আপলোড করুন', uploadHint: 'সর্বোচ্চ ৩০টি PDF এবং মোট ৫০ MB। একই বিষয়বস্তুর ফাইল শনাক্ত করা হবে।',
    choosePdfs: 'PDF বাছাই করুন', matching: 'আপলোড করা PDF মিলান', chooseFile: '— ফাইল বাছাই করুন —', expiryDate: 'মেয়াদ শেষের তারিখ',
    status: 'অবস্থা', mandatory: 'বাধ্যতামূলক', optional: 'ঐচ্ছিক', autoMatch: 'স্বয়ংক্রিয় মিল', generate: 'প্যাকেজ তৈরি করুন',
    generating: 'তৈরি হচ্ছে…', remove: 'সরান', file: 'ফাইল', pages: 'পৃষ্ঠা', duplicate: 'নকল',
    emptyTitle: 'শুরু করতে requirements ফাইল লোড করুন', emptyBody: 'টেন্ডারের বিবরণ ও কাগজপত্রের তালিকা দেখতে requirements.json বাছাই করুন।',
    invalidJson: 'ফাইলটি পড়া যায়নি। একটি সঠিক JSON ফাইল বাছাই করুন।',
    invalidShape: 'ফাইলে tender অবজেক্ট এবং requirements অ্যারে থাকতে হবে।',
    nonPdf: 'PDF নয় এমন ফাইল বাতিল করা হয়েছে।',
    badPdf: 'ফাইলটি নষ্ট অথবা পাসওয়ার্ড-সুরক্ষিত',
    fileLimit: 'সর্বোচ্চ ৩০টি ফাইল আপলোড করা যাবে।', sizeLimit: 'মোট আপলোড ৫০ MB-এর বেশি হতে পারবে না।',
    fileTooLarge: 'এই ফাইলটি যোগ করলে মোট আপলোড ৫০ MB ছাড়িয়ে যাবে।',
    readerError: 'PDF পাঠক লোড করা যায়নি। রিফ্রেশ করে আবার চেষ্টা করুন।',
    readError: 'এই ফাইলটি পড়া যায়নি।', uploadFailed: 'নির্বাচিত ফাইলগুলো প্রক্রিয়া করা যায়নি।',
    duplicateBlock: 'একই PDF-এর বিষয়বস্তু একাধিক কাগজের সাথে মেলানো যাবে না।',
    matchMissing: 'অনুপস্থিত', expiryNeeded: 'মেয়াদ প্রয়োজন', expired: 'মেয়াদোত্তীর্ণ', notProvided: 'দেওয়া হয়নি', ok: 'ঠিক আছে',
    noRequirements: 'এই ফাইলে কোনো প্রয়োজনীয় কাগজপত্র নেই।',
  },
};

function isRequirementsFile(value) {
  return value && typeof value === 'object' && value.tender && typeof value.tender === 'object' && Array.isArray(value.requirements);
}

function calculateStatus(requirement, matchedFile, expiryDate, submissionDeadline) {
  if (!matchedFile) return requirement.mandatory ? 'Missing' : 'Not provided';
  if (requirement.has_expiry && !expiryDate) return 'Expiry date needed';
  if (requirement.has_expiry && expiryDate < submissionDeadline) return 'Expired';
  return 'OK';
}

function filenameMatchScore(filename, title) {
  const normalize = (value) => value.toLowerCase().replace(/\.pdf$/i, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const file = normalize(filename);
  const name = normalize(title);
  if (!file || !name) return 0;
  if (file.includes(name)) return 1;
  const titleWords = new Set(name.split(/\s+/).filter((word) => word.length > 1));
  const fileWords = new Set(file.split(/\s+/).filter((word) => word.length > 1));
  return titleWords.size ? [...titleWords].filter((word) => fileWords.has(word)).length / titleWords.size : 0;
}

function statusLabel(status, t) {
  return ({ Missing: t.matchMissing, 'Expiry date needed': t.expiryNeeded, Expired: t.expired, 'Not provided': t.notProvided, OK: t.ok })[status];
}

function App() {
  const [tender, setTender] = useState(null);
  const [requirements, setRequirements] = useState([]);
  const [files, setFiles] = useState([]);
  const [matches, setMatches] = useState({});
  const [expiryDates, setExpiryDates] = useState({});
  const [language, setLanguage] = useState('en');
  const [requirementsError, setRequirementsError] = useState('');
  const [uploadMessages, setUploadMessages] = useState([]);
  const [packageError, setPackageError] = useState('');
  const [uploadBusy, setUploadBusy] = useState(false);
  const [packageBusy, setPackageBusy] = useState(false);
  const requirementsInput = useRef(null);
  const t = text[language];

  const fileById = useMemo(() => new Map(files.map((file) => [file.id, file])), [files]);
  const statuses = requirements.map((requirement) => calculateStatus(
    requirement,
    fileById.get(matches[requirement.id]),
    expiryDates[requirement.id],
    tender?.submission_deadline,
  ));
  const hasBlockingStatus = statuses.some((status) => ['Missing', 'Expiry date needed', 'Expired'].includes(status));
  const matchedHashes = new Map();
  requirements.forEach((requirement) => {
    const file = fileById.get(matches[requirement.id]);
    if (file) matchedHashes.set(file.hash, (matchedHashes.get(file.hash) ?? 0) + 1);
  });
  const duplicateConflict = [...matchedHashes.values()].some((count) => count > 1);

  async function loadRequirements(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (!isRequirementsFile(parsed)) {
        setRequirementsError(t.invalidShape);
        return;
      }
      setTender(parsed.tender);
      setRequirements([...parsed.requirements].sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0)));
      setMatches({});
      setExpiryDates({});
      setRequirementsError('');
      setPackageError('');
    } catch {
      setRequirementsError(t.invalidJson);
    }
  }

  function updateFiles(additions) {
    setFiles((current) => {
      const combined = [...current, ...additions];
      const hashes = combined.reduce((counts, file) => counts.set(file.hash, (counts.get(file.hash) ?? 0) + 1), new Map());
      return combined.map((file) => ({ ...file, duplicate: hashes.get(file.hash) > 1 }));
    });
  }

  async function uploadPdfs(event) {
    const selected = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (!selected.length) return;

    const messages = [];
    const pdfs = selected.filter((file) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'));
    if (pdfs.length !== selected.length) messages.push(`${selected.length - pdfs.length} ${t.nonPdf}`);
    if (files.length >= MAX_FILES) {
      messages.push(t.fileLimit);
      setUploadMessages(messages);
      return;
    }

    let totalBytes = files.reduce((total, file) => total + file.size, 0);
    let availableSlots = MAX_FILES - files.length;
    const accepted = [];
    for (const file of pdfs) {
      if (availableSlots <= 0) {
        messages.push(t.fileLimit);
        break;
      }
      if (totalBytes + file.size > MAX_TOTAL_BYTES) {
        messages.push(t.fileTooLarge);
        continue;
      }
      totalBytes += file.size;
      availableSlots -= 1;
      accepted.push(file);
    }
    if (!accepted.length) {
      setUploadMessages([...new Set(messages)]);
      return;
    }

    setUploadBusy(true);
    setUploadMessages([]);
    const parsed = [];
    let pdfjsLib;
    try {
      pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
    } catch {
      setUploadMessages([...messages, t.readerError]);
      setUploadBusy(false);
      return;
    }
    for (const file of accepted) {
      try {
        const buffer = await file.arrayBuffer();
        const digest = await crypto.subtle.digest('SHA-256', buffer);
        const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
        try {
          const pdf = await pdfjsLib.getDocument({ data: buffer.slice(0) }).promise;
          parsed.push({ id: `${hash}-${crypto.randomUUID()}`, file, name: file.name, size: file.size, pageCount: pdf.numPages, hash });
        } catch {
          messages.push(`${t.badPdf}: ${file.name}.`);
        }
      } catch (error) {
        messages.push(`${t.readError} ${file.name} (${error.message || 'unknown error'})`);
      }
    }
    if (parsed.length) updateFiles(parsed);
    setUploadMessages([...new Set(messages)]);
    setUploadBusy(false);
  }

  function removeFile(fileId) {
    setFiles((current) => {
      const remaining = current.filter((file) => file.id !== fileId);
      const hashes = remaining.reduce((counts, file) => counts.set(file.hash, (counts.get(file.hash) ?? 0) + 1), new Map());
      return remaining.map((file) => ({ ...file, duplicate: hashes.get(file.hash) > 1 }));
    });
    setMatches((current) => Object.fromEntries(Object.entries(current).filter(([, matchedId]) => matchedId !== fileId)));
  }

  function autoMatch() {
    const usedIds = new Set(Object.values(matches).filter(Boolean));
    const usedHashes = new Set(files.filter((file) => usedIds.has(file.id)).map((file) => file.hash));
    const next = { ...matches };
    const tenderYear = Number(String(tender?.submission_deadline || '').slice(0, 4));
    for (const requirement of requirements) {
      if (next[requirement.id] || !requirement.title_en) continue;
      const choices = files
        .filter((file) => !usedIds.has(file.id) && !usedHashes.has(file.hash))
        .map((file) => {
          const years = file.name.match(/20\d{2}/g)?.map(Number) ?? [];
          const yearDistance = years.length && tenderYear ? Math.min(...years.map((year) => Math.abs(year - tenderYear))) : 9999;
          return { file, score: filenameMatchScore(file.name, requirement.title_en), yearDistance };
        })
        .sort((a, b) => b.score - a.score || a.yearDistance - b.yearDistance || a.file.name.localeCompare(b.file.name));
      if (choices[0]?.score >= 0.5) {
        next[requirement.id] = choices[0].file.id;
        usedIds.add(choices[0].file.id);
        usedHashes.add(choices[0].file.hash);
      }
    }
    setMatches(next);
    setExpiryDates((current) => {
      const retained = {};
      for (const requirement of requirements) {
        if (next[requirement.id] === matches[requirement.id] && current[requirement.id]) retained[requirement.id] = current[requirement.id];
      }
      return retained;
    });
  }

  async function generate() {
    setPackageBusy(true);
    setPackageError('');
    try {
      const matchedRequirements = requirements.map((requirement) => ({ ...requirement, fileId: matches[requirement.id] || null }));
      await generatePackage(tender, matchedRequirements, files);
    } catch (error) {
      setPackageError(error.message || 'Could not generate the PDF package.');
    } finally {
      setPackageBusy(false);
    }
  }

  return (
    <main className="app-shell min-h-screen px-4 py-7 text-slate-900 sm:px-6 sm:py-10 lg:px-8" lang={language}>
      <div className="page-enter mx-auto max-w-5xl">
        <header className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <img
              src="/company-logo.png"
              alt="Meghna Tech Solutions logo"
              className="brand-logo h-14 w-14 shrink-0 rounded-2xl shadow-md sm:h-16 sm:w-16"
            />
            <div className="min-w-0">
              <p className="mb-2 text-xs font-bold tracking-[0.2em] text-indigo-700">{t.eyebrow}</p>
              <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl">{t.title}</h1>
              <p className="mt-2 text-sm text-slate-600 sm:text-base">{t.subtitle}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
            <button type="button" onClick={() => setLanguage((current) => current === 'en' ? 'bn' : 'en')} className="button-secondary">
              {t.language}
            </button>
            <input ref={requirementsInput} id="requirements-file" type="file" accept=".json,application/json" onChange={loadRequirements} className="sr-only" />
            <label htmlFor="requirements-file" className="button-primary cursor-pointer">{t.loadRequirements}</label>
          </div>
        </header>

        {requirementsError && <Alert>{requirementsError}</Alert>}

        <section className="card mb-8 p-5 sm:p-7">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-bold">{t.upload}</h2>
              <p className="mt-1 text-sm text-slate-500">{t.uploadHint}</p>
            </div>
            <label className={`button-secondary cursor-pointer ${uploadBusy ? 'pointer-events-none opacity-50' : ''}`}>
              {t.choosePdfs}
              <input type="file" accept="application/pdf,.pdf" multiple disabled={uploadBusy || packageBusy} onChange={uploadPdfs} className="sr-only" />
            </label>
          </div>
          {uploadBusy && <p role="status" className="upload-progress mb-3 flex items-center gap-2 text-sm font-medium text-indigo-700"><span className="spinner" aria-hidden="true" />Reading PDF files…</p>}
          {uploadMessages.map((message, index) => <Alert key={`${message}-${index}`}>{message}</Alert>)}
          {files.length > 0 && (
            <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
              {files.map((file, index) => (
                <li key={file.id} style={{ '--row-index': Math.min(index, 12) }} className="file-row flex min-w-0 flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="break-all font-semibold text-slate-800">{file.name}</p>
                    <p className="mt-1 text-sm text-slate-500">{file.pageCount} {t.pages} · {(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    {file.duplicate && <span className="badge-warning mt-2">{t.duplicate}</span>}
                  </div>
                  <button type="button" onClick={() => removeFile(file.id)} className="button-danger self-start sm:self-center">{t.remove}</button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {!tender ? (
          <section className="card border-dashed px-6 py-14 text-center sm:py-16">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-xl font-bold text-indigo-700" aria-hidden="true">↑</div>
            <h2 className="text-lg font-semibold">{t.emptyTitle}</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">{t.emptyBody}</p>
          </section>
        ) : (
          <>
            <section className="card mb-8 overflow-hidden">
              <div className="border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-white px-5 py-5 sm:px-7">
                <p className="text-sm font-semibold text-indigo-700">{t.tenderDetails}</p>
                <h2 className="mt-1 break-words text-2xl font-bold">{tender.title || '—'}</h2>
              </div>
              <dl className="grid gap-5 p-5 sm:grid-cols-2 sm:p-7 lg:grid-cols-4">
                <Detail label={t.tenderId} value={tender.tender_id} />
                <Detail label={t.procuringEntity} value={tender.procuring_entity} />
                <Detail label={t.bidder} value={tender.bidder} />
                <Detail label={t.deadline} value={tender.submission_deadline} />
              </dl>
            </section>

            <section>
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-xl font-bold">{t.requirements}</h2>
                  <p className="mt-1 text-sm text-slate-500">{requirements.length} {t.documents}</p>
                </div>
                <div>
                <button type="button" onClick={autoMatch} disabled={!files.length || !requirements.length} className="button-secondary disabled:cursor-not-allowed disabled:opacity-50">
                  {t.autoMatch}
                </button>
                </div>
              </div>
              {requirements.length ? (
                <ul className="space-y-3">
                  {requirements.map((requirement, index) => {
                    const file = fileById.get(matches[requirement.id]);
                    const status = calculateStatus(requirement, file, expiryDates[requirement.id], tender.submission_deadline);
                    const blocking = ['Missing', 'Expiry date needed', 'Expired'].includes(status);
                    const assignedElsewhere = new Set(Object.entries(matches)
                      .filter(([id, fileId]) => id !== requirement.id && fileId)
                      .map(([, fileId]) => fileById.get(fileId)?.hash)
                      .filter(Boolean));
                    return (
                      <li key={requirement.id ?? `${requirement.order}-${index}`} style={{ '--row-index': Math.min(index, 12) }} className="card requirement-row flex min-w-0 flex-col gap-5 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex min-w-0 items-start gap-3 sm:gap-4 lg:flex-1">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-sm font-bold text-indigo-700">
                            {String(requirement.order ?? index + 1).padStart(2, '0')}
                          </span>
                          <div className="min-w-0">
                            <h3 className="break-words font-semibold text-slate-900">
                              {language === 'en' ? requirement.title_en || requirement.title_bn || requirement.id : requirement.title_bn || requirement.title_en || requirement.id}
                            </h3>
                            {requirement.id && <p className="mt-1 text-xs text-slate-500">{requirement.id}</p>}
                            <span className={requirement.mandatory ? 'badge-warning mt-2' : 'badge-neutral mt-2'}>
                              {requirement.mandatory ? t.mandatory : t.optional}
                            </span>
                          </div>
                        </div>
                        <div className="grid min-w-0 gap-3 lg:w-[22rem] lg:shrink-0">
                          <label className="field-label">
                            {t.matching}
                            <select
                              value={matches[requirement.id] || ''}
                              onChange={(event) => {
                                const nextFileId = event.target.value || null;
                                setMatches((current) => ({ ...current, [requirement.id]: nextFileId }));
                                setExpiryDates((current) => ({ ...current, [requirement.id]: '' }));
                              }}
                              className="field-control"
                            >
                              <option value="">{t.chooseFile}</option>
                              {files.filter((candidate) => (!assignedElsewhere.has(candidate.hash) || candidate.id === matches[requirement.id]))
                                .map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}{candidate.duplicate ? ` · ${t.duplicate}` : ''}</option>)}
                            </select>
                          </label>
                          {requirement.has_expiry && file && (
                            <label className="field-label">
                              {t.expiryDate}
                              <input type="date" value={expiryDates[requirement.id] || ''} onChange={(event) => setExpiryDates((current) => ({ ...current, [requirement.id]: event.target.value }))} className="field-control" />
                            </label>
                          )}
                          <div>
                            <p className="field-label mb-1">{t.status}</p>
                            <span key={status} className={`status-pop ${blocking ? 'badge-danger' : status === 'OK' ? 'badge-success' : 'badge-neutral'}`}>{statusLabel(status, t)}</span>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="card p-6 text-sm text-slate-500">{t.noRequirements}</p>
              )}

              <div className="mt-6 flex flex-col items-start gap-2">
                <button type="button" onClick={generate} disabled={hasBlockingStatus || duplicateConflict || packageBusy || uploadBusy} className="button-primary disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500">
                  {packageBusy ? t.generating : t.generate}
                </button>
                {duplicateConflict && <p role="alert" className="text-sm text-rose-700">{t.duplicateBlock}</p>}
                {packageError && <Alert>{packageError}</Alert>}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function Alert({ children }) {
  return <p role="alert" className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{children}</p>;
}

function Detail({ label, value }) {
  return <div className="min-w-0"><dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</dt><dd className="mt-1 break-words text-sm font-medium text-slate-800">{value || '—'}</dd></div>;
}

export default App;
