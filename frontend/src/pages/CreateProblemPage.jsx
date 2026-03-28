import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../services/api.js';

const DIFFICULTIES = ['easy', 'medium', 'hard'];

const CreateProblemPage = () => {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [difficulty, setDifficulty] = useState('easy');
  const [tagsInput, setTagsInput] = useState('');
  const [testCases, setTestCases] = useState([
    { input: '', expectedOutput: '', isHidden: false },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const tags = tagsInput
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

  const addTestCase = () => {
    setTestCases((prev) => [...prev, { input: '', expectedOutput: '', isHidden: false }]);
  };

  const removeTestCase = (index) => {
    if (testCases.length <= 1) return;
    setTestCases((prev) => prev.filter((_, i) => i !== index));
  };

  const updateTestCase = (index, field, value) => {
    setTestCases((prev) =>
      prev.map((tc, i) => (i === index ? { ...tc, [field]: value } : tc))
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (tags.length === 0) {
      toast.error('Enter at least one tag (comma-separated)');
      return;
    }

    const payload = {
      title: title.trim(),
      description: description.trim(),
      difficulty: difficulty.toLowerCase(),
      tags,
      testCases: testCases.map((tc) => ({
        input: tc.input.trim(),
        expectedOutput: tc.expectedOutput.trim(),
        isHidden: Boolean(tc.isHidden),
      })),
    };

    setIsSubmitting(true);
    try {
      const response = await api.post('/problems', payload);
      toast.success(response.data.message || 'Problem created');
      navigate(`/problems/${response.data.problem.id}`, { replace: true });
    } catch (error) {
      const message =
        error.response?.data?.error || error.message || 'Failed to create problem';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass =
    'w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500';
  const labelClass = 'block text-sm font-medium text-slate-200 mb-1';

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link
          to="/problems"
          className="text-sm text-slate-400 hover:text-slate-50"
        >
          ← Back to problems
        </Link>
      </div>

      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-6 shadow-lg">
        <h2 className="text-xl font-semibold text-slate-50 mb-4">
          Create a problem
        </h2>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className={labelClass}>Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              minLength={3}
              maxLength={200}
              className={inputClass}
              placeholder="e.g. Two Sum"
            />
          </div>

          <div>
            <label className={labelClass}>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              minLength={10}
              rows={6}
              className={inputClass}
              placeholder="Problem description, examples, and constraints..."
            />
          </div>

          <div>
            <label className={labelClass}>Difficulty</label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className={inputClass}
            >
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>
                  {d.charAt(0).toUpperCase() + d.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Tags (comma-separated)</label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              className={inputClass}
              placeholder="e.g. array, hash-table, two-pointers"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={labelClass}>Test cases</label>
              <button
                type="button"
                onClick={addTestCase}
                className="text-sm text-indigo-400 hover:text-indigo-300"
              >
                + Add test case
              </button>
            </div>
            <div className="space-y-3">
              {testCases.map((tc, index) => (
                <div
                  key={index}
                  className="p-3 rounded-lg bg-slate-950 border border-slate-700 space-y-2"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-400">Test case {index + 1}</span>
                    {testCases.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeTestCase(index)}
                        className="text-xs text-rose-400 hover:text-rose-300"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={tc.input}
                    onChange={(e) => updateTestCase(index, 'input', e.target.value)}
                    required
                    className={inputClass}
                    placeholder="Input (e.g. JSON or plain text)"
                  />
                  <input
                    type="text"
                    value={tc.expectedOutput}
                    onChange={(e) =>
                      updateTestCase(index, 'expectedOutput', e.target.value)
                    }
                    required
                    className={inputClass}
                    placeholder="Expected output"
                  />
                  <label className="flex items-center gap-2 text-sm text-slate-300">
                    <input
                      type="checkbox"
                      checked={tc.isHidden}
                      onChange={(e) =>
                        updateTestCase(index, 'isHidden', e.target.checked)
                      }
                      className="rounded border-slate-600 bg-slate-950 text-indigo-500 focus:ring-indigo-500"
                    />
                    Hidden (not shown to users)
                  </label>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 flex justify-center items-center px-4 py-2 rounded-md bg-indigo-500 text-white text-sm font-medium hover:bg-indigo-400 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Creating...' : 'Create problem'}
            </button>
            <Link
              to="/problems"
              className="px-4 py-2 rounded-md border border-slate-600 text-slate-200 text-sm font-medium hover:bg-slate-800"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateProblemPage;
