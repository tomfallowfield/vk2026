const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL = 254;
const MAX_NAME = 200;
const MAX_URL = 2048;
const MAX_MESSAGE = 5000;
const MAX_COMMENTS = 3000;

function isValidEmail(s) {
  if (typeof s !== 'string' || s.length > MAX_EMAIL) return false;
  return EMAIL_REGEX.test(s.trim());
}

function isValidUrl(s) {
  if (typeof s !== 'string' || !s.trim()) return true; // optional
  if (s.length > MAX_URL) return false;
  try {
    new URL(s.trim());
    return true;
  } catch {
    return false;
  }
}

function trimStr(s, max) {
  if (typeof s !== 'string') return '';
  return s.trim().slice(0, max);
}

function validateBookACall(body) {
  const errors = [];
  const name = trimStr(body.name, MAX_NAME);
  if (!name) errors.push('Name is required.');
  const email = trimStr(body.email, MAX_EMAIL);
  if (!email) errors.push('Email is required.');
  else if (!isValidEmail(email)) errors.push('Please enter a valid email address.');
  if (body.website && !isValidUrl(body.website)) errors.push('Please enter a valid website address.');
  if (body.linkedin_url && !isValidUrl(body.linkedin_url)) errors.push('Please enter a valid LinkedIn URL.');
  if (body.message && body.message.length > MAX_MESSAGE) errors.push('Message is too long.');
  return { errors, data: { name, email, website: trimStr(body.website, MAX_URL), linkedin_url: trimStr(body.linkedin_url, MAX_URL), message: trimStr(body.message, MAX_MESSAGE), phone: trimStr(body.phone, 50) } };
}

function validateWebsiteReview(body) {
  const errors = [];
  const name = trimStr(body.name, MAX_NAME);
  if (!name) errors.push('Name is required.');
  if (body.website && !isValidUrl(body.website)) errors.push('Please enter a valid website URL.');
  if (body.linkedin_url && !isValidUrl(body.linkedin_url)) errors.push('Please enter a valid LinkedIn URL.');
  if (body.comments && body.comments.length > MAX_COMMENTS) errors.push('Comments are too long.');
  return {
    errors,
    data: {
      name,
      website: trimStr(body.website, MAX_URL),
      linkedin_url: trimStr(body.linkedin_url, MAX_URL),
      comments: trimStr(body.comments, MAX_COMMENTS)
    }
  };
}

function validateLead(body) {
  const errors = [];
  const name = trimStr(body.name, MAX_NAME);
  if (!name) errors.push('Name is required.');
  const email = trimStr(body.email, MAX_EMAIL);
  if (!email) errors.push('Email is required.');
  else if (!isValidEmail(email)) errors.push('Please enter a valid email address.');
  const source = (body.source || '').trim();
  const validSources = ['lead-50things', 'lead-offboarding', 'lead-socialproof'];
  if (!validSources.includes(source)) errors.push('Invalid lead source.');
  return { errors, data: { name, email, source } };
}

module.exports = { validateBookACall, validateWebsiteReview, validateLead };
