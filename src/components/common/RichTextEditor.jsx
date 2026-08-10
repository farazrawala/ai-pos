import { useMemo } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import './rich-text-editor.css';

const DEFAULT_MODULES = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    [{ indent: '-1' }, { indent: '+1' }],
    ['link'],
    ['clean'],
  ],
};

const DEFAULT_FORMATS = [
  'header',
  'bold',
  'italic',
  'underline',
  'strike',
  'list',
  'bullet',
  'indent',
  'link',
];

/**
 * HTML rich-text editor for product descriptions and similar fields.
 */
export default function RichTextEditor({
  id,
  value = '',
  onChange,
  placeholder = '',
  disabled = false,
  className = '',
}) {
  const modules = useMemo(() => DEFAULT_MODULES, []);

  return (
    <div
      id={id}
      className={`rich-text-editor${disabled ? ' is-disabled' : ''}${className ? ` ${className}` : ''}`}
    >
      <ReactQuill
        theme="snow"
        value={value || ''}
        onChange={(html) => {
          if (disabled) return;
          // Quill uses <p><br></p> for empty — normalize to empty string for forms.
          const normalized =
            !html || html === '<p><br></p>' || html === '<p></p>' ? '' : html;
          onChange?.(normalized);
        }}
        modules={modules}
        formats={DEFAULT_FORMATS}
        placeholder={placeholder}
        readOnly={disabled}
      />
    </div>
  );
}
