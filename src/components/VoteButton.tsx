import React from 'react';

interface Props {
  voters: string[];
  currentPerson: string;
  onToggle: () => void;
}

const initials = (name: string) => name.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();

const AVATAR_COLORS = ['#3a6b8c', '#5e6b4e', '#b8523a', '#8c5e3a', '#5e3a8c', '#3a8c6b', '#a55c3e', '#4e6b6b'];
const getColor = (name: string) => AVATAR_COLORS[Math.abs(name.split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % AVATAR_COLORS.length];

const VoteButton: React.FC<Props> = ({ voters, currentPerson, onToggle }) => {
  const hasVoted = currentPerson !== '' && voters.includes(currentPerson);
  const disabled = currentPerson === '';
  const count = voters.length;

  return (
    <button
      type="button"
      className={`vote-chip${hasVoted ? ' voted' : ''}`}
      onClick={onToggle}
      disabled={disabled}
      style={disabled ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
      aria-pressed={hasVoted}
      aria-label={`${count} vote${count === 1 ? '' : 's'}${hasVoted ? ' (you voted)' : ''}`}
      title={count === 0 ? 'No votes yet' : voters.join(', ')}
    >
      <span className="heart">{hasVoted ? '♥' : '♡'}</span>
      <span className="count">{count}</span>
      {count > 0 && (
        <span className="stack">
          {voters.slice(0, 3).map((name) => (
            <span key={name} className="av" style={{ background: getColor(name) }}>
              {initials(name)}
            </span>
          ))}
          {count > 3 && (
            <span className="av" style={{ background: 'var(--ink-3)' }}>+{count - 3}</span>
          )}
        </span>
      )}
    </button>
  );
};

export default VoteButton;
