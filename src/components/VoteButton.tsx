import React from 'react';
import { OverlayTrigger, Tooltip } from 'react-bootstrap';
import { FaThumbsUp } from 'react-icons/fa';

interface Props {
  voters: string[];
  currentPerson: string;
  onToggle: () => void;
}

const VoteButton: React.FC<Props> = ({ voters, currentPerson, onToggle }) => {
  const hasVoted = currentPerson !== '' && voters.includes(currentPerson);
  const disabled = currentPerson === '';
  const count = voters.length;

  const tooltip = (
    <Tooltip id="vote-tooltip">
      {disabled
        ? 'Select a person to vote'
        : count === 0
          ? 'No votes yet'
          : voters.join(', ')}
    </Tooltip>
  );

  return (
    <OverlayTrigger placement="top" overlay={tooltip}>
      <span className="d-inline-block">
        <button
          type="button"
          className={`vote-btn${hasVoted ? ' active' : ''}`}
          onClick={onToggle}
          disabled={disabled}
          style={disabled ? { pointerEvents: 'none' } : undefined}
          aria-label={`${count} vote${count === 1 ? '' : 's'}${hasVoted ? ' (you voted)' : ''}`}
        >
          <FaThumbsUp size={12} />
          {count > 0 && <span className="vote-count">{count}</span>}
        </button>
      </span>
    </OverlayTrigger>
  );
};

export default VoteButton;
