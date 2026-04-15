/**
 * ModalForm Component
 * 
 * Provides a standard wrapper for wa-dialog with a common footer (Accept/Cancel).
 * 
 * Props:
 * - id: string (required) - Dialog ID
 * - label: string - Dialog title
 * - open: boolean - Visibility
 * - onAccept: function - Callback for Accept button. If null, hide button.
 * - onCancel: function - Callback for Cancel button. If null, hide button.
 * - acceptLabel: string - Label for Accept button (default: 'Ok')
 * - loading: boolean - Loading state for Accept button
 * - disabled: boolean - Disabled state for Accept button
 * - onHide: function - onwa-after-hide callback
 */
const ModalForm = {
  view({ attrs, children }) {
    const {
      id,
      label,
      open,
      onAccept,
      onCancel,
      acceptLabel = 'Ok',
      loading = false,
      disabled = false,
      onHide,
      ...restAttrs
    } = attrs;

    return m('wa-dialog[light-dismiss]', {
      id,
      label,
      open: open || undefined,
      onwa_after_hide: onHide,
      ...restAttrs
    }, [
      // Body
      m('.wa-stack', children),

      // Footer
      m('.wa-cluster.wa-justify-content-end[slot=footer]', [
        m([button, '.outlined[data-dialog=close]'], {
          onclick: onCancel
        }, 'Cancel'),
        
        m([button, '.brand.accent[data-dialog=close]'], {
          loading: loading || undefined,
          disabled: disabled || undefined,
          onclick: onAccept
        }, acceptLabel),
      ])
    ]);
  }
};

export default ModalForm;
