import React from 'react';
import territoryData from '../public/data/territory.json';

export default function TerritoryPage() {
  // Rendering logic for Territory Intelligence
  return (
    <div className='container'>
      <h1>Territory Intelligence</h1>
      <ul>
        {territoryData.map((advisor) => (
          <li key={advisor.email}>
            <div className='advisor-card'>
              <h2>{advisor.name}</h2>
              <p>Firm: {advisor.firm}</p>
              <p>Office: {advisor.office}</p>
              <p>Email: {advisor.email}</p>
              <p>Phone: {advisor.phone}</p>
              <p>Status: {advisor.status}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
