import Editor from '@monaco-editor/react';

const CodeEditor = ({ language, code, onChange }) => {
  return (
    <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950">
      <Editor
        height="420px"
        defaultLanguage={language}
        language={language}
        value={code}
        theme="vs-dark"
        onChange={(value) => onChange(value ?? '')}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          scrollBeyondLastLine: false,
        }}
      />
    </div>
  );
};

export default CodeEditor;

