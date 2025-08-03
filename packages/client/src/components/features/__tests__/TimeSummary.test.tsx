import React from 'react';
import { render, screen } from '@testing-library/react';
import { TimeSummary } from '../TimeSummary';

describe('TimeSummary', () => {
  const defaultProps = {
    totalTime: 28800, // 8 hours in seconds
    totalEntries: 15,
    averageSessionTime: 1920, // 32 minutes in seconds
    mostProductiveDay: 'Monday',
    mostUsedProject: 'Development Project',
  };

  it('renders summary statistics', () => {
    render(<TimeSummary {...defaultProps} />);

    expect(screen.getByText('Summary')).toBeInTheDocument();
    expect(screen.getByText('Total Time')).toBeInTheDocument();
    expect(screen.getByText('8:00:00')).toBeInTheDocument();
    expect(screen.getByText('Total Entries')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.getByText('Average Session')).toBeInTheDocument();
    expect(screen.getByText('32:00')).toBeInTheDocument();
  });

  it('renders additional insights when provided', () => {
    render(<TimeSummary {...defaultProps} />);

    expect(screen.getByText('Most Productive Day:')).toBeInTheDocument();
    expect(screen.getByText('Monday')).toBeInTheDocument();
    expect(screen.getByText('Most Used Project:')).toBeInTheDocument();
    expect(screen.getByText('Development Project')).toBeInTheDocument();
  });

  it('does not render insights section when data is not provided', () => {
    render(
      <TimeSummary
        totalTime={defaultProps.totalTime}
        totalEntries={defaultProps.totalEntries}
        averageSessionTime={defaultProps.averageSessionTime}
      />
    );

    expect(screen.queryByText('Most Productive Day:')).not.toBeInTheDocument();
    expect(screen.queryByText('Most Used Project:')).not.toBeInTheDocument();
  });

  it('handles zero values correctly', () => {
    render(
      <TimeSummary
        totalTime={0}
        totalEntries={0}
        averageSessionTime={0}
      />
    );

    expect(screen.getAllByText('0:00')).toHaveLength(2); // Total time and average session
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('formats large time values correctly', () => {
    render(
      <TimeSummary
        totalTime={90061} // 25 hours, 1 minute, 1 second
        totalEntries={100}
        averageSessionTime={3661} // 1 hour, 1 minute, 1 second
      />
    );

    expect(screen.getByText('25:01:01')).toBeInTheDocument();
    expect(screen.getByText('1:01:01')).toBeInTheDocument();
  });
});