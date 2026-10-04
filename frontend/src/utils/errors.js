const SESSION_EXPIRED = 'Your session has expired. Please log in again.'

export function getErrorMessage(error) {
  if (!error || !error.response) {
    return 'Unable to connect to the BMS server.'
  }

  const status = error.response.status
  const apiMessage = error.response.data?.error?.message

  if (status === 401) {
    if (apiMessage === 'Invalid email or password') {
      return apiMessage
    }

    return SESSION_EXPIRED
  }

  if (status === 403) {
    return 'You do not have permission to perform this action.'
  }

  if (status === 404) {
    return 'The requested information could not be found.'
  }

  if (status === 409) {
    return apiMessage || 'This record conflicts with an existing one.'
  }

  if (status === 400 || status === 422) {
    return 'Please check the information and try again.'
  }

  if (status >= 500) {
    return 'Something went wrong. Please try again.'
  }

  return 'Something went wrong. Please try again.'
}

export function getFieldErrors(error) {
  const details = error?.response?.data?.error?.details

  if (!Array.isArray(details)) {
    return {}
  }

  return details.reduce((fields, item) => {
    const key = String(item.field || '').split('.').pop()

    if (key && key !== 'body') {
      fields[key] = item.message
    }

    return fields
  }, {})
}
