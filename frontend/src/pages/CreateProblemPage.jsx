import { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../services/api.js';

const DIFFICULTIES = ['easy', 'medium', 'hard'];

const PARAM_TYPES = [
  { value: 'integer', label: 'Integer', placeholder: '5' },
  { value: 'string',  label: 'String',  placeholder: 'bab' },
  { value: 'float',   label: 'Float',   placeholder: '3.14' },
  { value: 'array',   label: 'Array',   placeholder: '1 2 3 4 5' },
  { value: 'boolean', label: 'Boolean', placeholder: 'true' },
];

const emptyParam = () => ({ type: 'integer', value: '' });
const emptyTestCase = () => ({ parameters: [emptyParam()], expectedOutput: '', isHidden: false });

const detectType = (val) => {
  const v = val.trim();
  if (/^-?\d+$/.test(v)) return 'integer';
  if (/^-?\d+\.\d+$/.test(v)) return 'float';
  if (/^(true|false)$/i.test(v)) return 'boolean';
  if (/^(\[.*\]|-?\d+(\s+-?\d+)+)$/.test(v)) return 'array';
  return 'string';
};

const stripSurroundingQuotes = (str) => {
  if ((str.startsWith('"') && str.endsWith('"')) ||
      (str.startsWith("'") && str.endsWith("'"))) {
    return str.slice(1, -1);
  }
  return str;
};

const inputToParameters = (input) => {
  const lines = (input || '').split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return [emptyParam()];
  return lines.map(line => {
    const clean = stripSurroundingQuotes(line);
    return { type: detectType(clean), value: clean };
  });
};

const parametersToInput = (params) =>
  params.map(p => p.value.trim()).join('\n');

const CreateProblemPage = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [title, setTitle]             = useState('');
  const [description, setDescription] = useState('');
  const [difficulty, setDifficulty]   = useState('easy');
  const [tagsInput, setTagsInput]     = useState('');
  const [testCases, setTestCases]     = useState([emptyTestCase()]);
  const [isSubmitting, setIsSubmitting]           = useState(false);
  const [imageFile, setImageFile]                 = useState(null);
  const [imagePreview, setImagePreview]           = useState(null);
  const [isImageSubmitting, setIsImageSubmitting] = useState(false);
  const [isDragging, setIsDragging]               = useState(false);

  const tags = tagsInput.split(',').map((t) => t.trim()).filter(Boolean);

  const applyImageFile = (file) => {
    if (!file || !file.type.startsWith('image/')) {
      toast.error('Please select a valid image file');
      return;
    }
    setImageFile(file);
    setImagePreview((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return URL.createObjectURL(file);
    });
  };

  const handleImageChange  = (e) => { const f = e.target.files?.[0]; if (f) applyImageFile(f); };
  const handleDragOver     = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave    = () => setIsDragging(false);
  const handleDrop         = (e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files?.[0]; if (f) applyImageFile(f); };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleImageSubmit = async () => {
    if (!imageFile || isImageSubmitting) return;
    setIsImageSubmitting(true);
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload  = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(imageFile);
      });

      const { data } = await api.post('/problems/extract-from-image', { base64, mimeType: imageFile.type });

      if (data.title) setTitle(data.title);
      if (data.description) setDescription(data.description);
      if (data.difficulty && DIFFICULTIES.includes(data.difficulty)) setDifficulty(data.difficulty);
      if (Array.isArray(data.tags) && data.tags.length > 0) setTagsInput(data.tags.join(', '));
      if (Array.isArray(data.testCases) && data.testCases.length > 0) {
        setTestCases(data.testCases.map(tc => ({
          parameters: inputToParameters(tc.input ?? ''),
          expectedOutput: stripSurroundingQuotes((tc.expectedOutput ?? '').trim()),
          isHidden: Boolean(tc.isHidden),
        })));
      }

      toast.success('Fields populated from image');
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Failed to extract problem from image');
    } finally {
      setIsImageSubmitting(false);
    }
  };

  const addTestCase    = () => setTestCases(prev => [...prev, emptyTestCase()]);
  const removeTestCase = (i) => { if (testCases.length > 1) setTestCases(prev => prev.filter((_, idx) => idx !== i)); };

  const updateTestCase = (i, field, value) =>
    setTestCases(prev => prev.map((tc, idx) => idx === i ? { ...tc, [field]: value } : tc));

  const addParameter = (tcIndex) =>
    setTestCases(prev => prev.map((tc, i) =>
      i === tcIndex ? { ...tc, parameters: [...tc.parameters, emptyParam()] } : tc
    ));

  const removeParameter = (tcIndex, pIndex) =>
    setTestCases(prev => prev.map((tc, i) =>
      i === tcIndex ? { ...tc, parameters: tc.parameters.filter((_, pi) => pi !== pIndex) } : tc
    ));

  const updateParameter = (tcIndex, pIndex, field, value) =>
    setTestCases(prev => prev.map((tc, i) =>
      i === tcIndex
        ? { ...tc, parameters: tc.parameters.map((p, pi) => pi === pIndex ? { ...p, [field]: value } : p) }
        : tc
    ));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (tags.length === 0) { toast.error('Enter at least one tag'); return; }

    const payload = {
      title: title.trim(),
      description: description.trim(),
      difficulty: difficulty.toLowerCase(),
      tags,
      testCases: testCases.map(tc => ({
        input: parametersToInput(tc.parameters),
        expectedOutput: tc.expectedOutput.trim(),
        isHidden: Boolean(tc.isHidden),
      })),
    };

    setIsSubmitting(true);
    try {
      const res = await api.post('/problems', payload);
      toast.success(res.data.message || 'Problem created');
      navigate(`/problems/${res.data.problem.id}`, { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Failed to create problem');
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass = 'w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500';
  const labelClass = 'block text-sm font-medium text-slate-200 mb-1';

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <Link to="/problems" className="text-sm text-slate-400 hover:text-slate-50">← Back to problems</Link>
      </div>

      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-6 shadow-lg space-y-6">
        <h2 className="text-xl font-semibold text-slate-50">Create a problem</h2>

        <div className="space-y-3">
          <p className="text-sm font-medium text-slate-200">
            Import from image
            <span className="ml-2 text-xs font-normal text-slate-500">
              Upload a screenshot to auto-fill the form
            </span>
          </p>

          <div
            onClick={() => !imageFile && fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed transition-colors
              ${imageFile ? 'border-slate-700 cursor-default' : 'cursor-pointer hover:border-indigo-500/60'}
              ${isDragging ? 'border-indigo-500 bg-indigo-500/5' : 'border-slate-700 bg-slate-950/50'}`}
            style={{ minHeight: imagePreview ? 'auto' : '140px' }}
          >
            <input ref={fileInputRef} type="file" accept="image/*" className="sr-only" onChange={handleImageChange} />

            {imagePreview ? (
              <div className="w-full p-3">
                <div className="relative rounded-lg overflow-hidden border border-slate-700">
                  <img src={imagePreview} alt="Preview" className="w-full max-h-64 object-contain bg-slate-950" />
                  <button type="button" onClick={clearImage}
                    className="absolute top-2 right-2 h-6 w-6 rounded-full bg-slate-900/80 border border-slate-700 text-slate-400 hover:text-slate-50 flex items-center justify-center text-xs">
                    ✕
                  </button>
                </div>
                <p className="mt-2 text-xs text-slate-500 text-center truncate px-2">{imageFile.name}</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 py-10 px-4 text-center select-none">
                <div className="h-10 w-10 rounded-full bg-slate-800 flex items-center justify-center text-xl">🖼️</div>
                <p className="text-sm text-slate-300">Drop an image here, or <span className="text-indigo-400 underline underline-offset-2">browse</span></p>
                <p className="text-xs text-slate-600">PNG, JPG, WEBP supported</p>
              </div>
            )}
          </div>

          <button type="button" onClick={handleImageSubmit} disabled={!imageFile || isImageSubmitting}
            className="w-full flex items-center justify-center gap-2 rounded-md bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            {isImageSubmitting
              ? <><span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />Extracting…</>
              : 'Extract & auto-fill fields'}
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1 border-t border-slate-800" />
          <span className="text-xs text-slate-600">or fill manually</span>
          <div className="flex-1 border-t border-slate-800" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className={labelClass}>Title</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)}
              required minLength={3} maxLength={200} className={inputClass} placeholder="e.g. Two Sum" />
          </div>

          <div>
            <label className={labelClass}>Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              required minLength={10} rows={6} className={inputClass}
              placeholder="Problem description, examples, and constraints..." />
          </div>

          <div>
            <label className={labelClass}>Difficulty</label>
            <select value={difficulty} onChange={e => setDifficulty(e.target.value)} className={inputClass}>
              {DIFFICULTIES.map(d => (
                <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Tags (comma-separated)</label>
            <input type="text" value={tagsInput} onChange={e => setTagsInput(e.target.value)}
              className={inputClass} placeholder="e.g. array, hash-table, two-pointers" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={labelClass}>Test cases</label>
              <button type="button" onClick={addTestCase} className="text-sm text-indigo-400 hover:text-indigo-300">
                + Add test case
              </button>
            </div>

            <div className="space-y-4">
              {testCases.map((tc, tcIdx) => (
                <div key={tcIdx} className="rounded-lg bg-slate-950 border border-slate-700 p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium text-slate-400">Test case {tcIdx + 1}</span>
                    {testCases.length > 1 && (
                      <button type="button" onClick={() => removeTestCase(tcIdx)}
                        className="text-xs text-rose-400 hover:text-rose-300">Remove</button>
                    )}
                  </div>

                  <div className="space-y-2">
                    <span className="text-xs text-slate-500 uppercase tracking-wider">Input parameters</span>
                    {tc.parameters.map((param, pIdx) => (
                      <div key={pIdx} className="flex items-center gap-2">
                        <select
                          value={param.type}
                          onChange={e => updateParameter(tcIdx, pIdx, 'type', e.target.value)}
                          className="shrink-0 w-28 rounded-md bg-slate-900 border border-slate-700 px-2 py-1.5 text-xs text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          {PARAM_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>

                        <input
                          type="text"
                          value={param.value}
                          onChange={e => updateParameter(tcIdx, pIdx, 'value', e.target.value)}
                          required
                          placeholder={PARAM_TYPES.find(t => t.value === param.type)?.placeholder ?? ''}
                          className="flex-1 rounded-md bg-slate-900 border border-slate-700 px-3 py-1.5 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />

                        {tc.parameters.length > 1 && (
                          <button type="button" onClick={() => removeParameter(tcIdx, pIdx)}
                            className="shrink-0 text-slate-600 hover:text-rose-400 text-lg leading-none px-1">×</button>
                        )}
                      </div>
                    ))}

                    <button type="button" onClick={() => addParameter(tcIdx)}
                      className="text-xs text-slate-500 hover:text-indigo-400 flex items-center gap-1">
                      + Add parameter
                    </button>
                  </div>

                  <div>
                    <span className="text-xs text-slate-500 uppercase tracking-wider">Expected output</span>
                    <input
                      type="text"
                      value={tc.expectedOutput}
                      onChange={e => updateTestCase(tcIdx, 'expectedOutput', e.target.value)}
                      required
                      placeholder="e.g. 3"
                      className={`mt-1.5 ${inputClass}`}
                    />
                  </div>

                  <label className="flex items-center gap-2 text-sm text-slate-300">
                    <input type="checkbox" checked={tc.isHidden}
                      onChange={e => updateTestCase(tcIdx, 'isHidden', e.target.checked)}
                      className="rounded border-slate-600 bg-slate-950 text-indigo-500 focus:ring-indigo-500" />
                    Hidden (not shown to users)
                  </label>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={isSubmitting}
              className="flex-1 flex justify-center items-center px-4 py-2 rounded-md bg-indigo-500 text-white text-sm font-medium hover:bg-indigo-400 disabled:opacity-60 disabled:cursor-not-allowed">
              {isSubmitting ? 'Creating…' : 'Create problem'}
            </button>
            <Link to="/problems"
              className="px-4 py-2 rounded-md border border-slate-600 text-slate-200 text-sm font-medium hover:bg-slate-800">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateProblemPage;
