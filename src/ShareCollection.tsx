import { useState } from 'react';
import { Modal } from './components';
import { buildShareUrl, shareSourceOptions } from './share-links';
import type { CollectionSource } from './domain';
import './share.css';

// The link and a Copy button. Choosing a source and the web address appear only when needed.
export default function ShareCollection({ sources, onClose }: { sources: CollectionSource[]; onClose: () => void }) {
  const options = shareSourceOptions(sources);
  const [key, setKey] = useState(options[0]?.key || '');
  // The desktop app has no web address of its own, so it asks for one first.
  const [base, setBase] = useState(location.protocol === 'archive:' ? '' : location.origin);
  const [editBase, setEditBase] = useState(!base);
  const [status, setStatus] = useState('');
  const source = options.find(item => item.key === key);
  let link = '';
  try { if (source) link = buildShareUrl(base, source); } catch { /* The address can be entered below. */ }
  return <Modal title={options.length === 1 && source ? `Share ${source.name}` : 'Share a collection'} onClose={onClose}>
    <div className="share-dialog">
      {options.length > 1 && <label>Account or folder<select value={key} onChange={event => { setKey(event.target.value); setStatus(''); }}>
        {options.map(item => <option key={item.key} value={item.key}>{item.kind === 'account' ? 'Account' : 'Folder'}: {item.name}</option>)}
      </select></label>}
      {!options.length && <p>Add an Archidekt account or folder in Library to share it.</p>}
      {source && <>
        <p>Opens {source.kind === 'account' ? `${source.name}'s public decks` : `the public decks in ${source.name}`} on DeckShelf, read-only.</p>
        <div className="share-link-row">
          <input aria-label="Collection link" readOnly value={link} placeholder="Enter the web address below" onFocus={event => event.target.select()} />
          <button className="button button-gold" disabled={!link} onClick={async () => {
            try { await navigator.clipboard.writeText(link); setStatus('Link copied.'); }
            catch { setStatus('Copy was unavailable. Select the link above and copy it.'); }
          }}>Copy link</button>
        </div>
        <p className="share-status" role="status">{status}</p>
        {editBase
          ? <label>DeckShelf web address<input value={base} placeholder="https://your-deckshelf.example" onChange={event => { setBase(event.target.value); setStatus(''); }} /></label>
          : <button className="text-button share-base-toggle" onClick={() => setEditBase(true)}>Use another web address</button>}
      </>}
    </div>
  </Modal>;
}
