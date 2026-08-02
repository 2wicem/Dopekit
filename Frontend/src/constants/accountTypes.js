export const ACCOUNT_TYPES = {
  client: {
    value: 'client',
    label: 'Client',
    shortLabel: 'Book appointments',
    signupTitle: 'Create your account',
    signupSubtitle: 'Sign up to book faster and save your details for next time.',
    submitLabel: 'Sign up as client',
  },
  technician: {
    value: 'technician',
    label: 'Technician',
    shortLabel: 'Studio team',
    signupTitle: 'Welcome to the studio',
    signupSubtitle:
      'Apply as a technician. An admin will review your account before you can access the staff dashboard.',
    submitLabel: 'Submit application',
  },
  salon_owner: {
    value: 'salon_owner',
    label: 'Salon owner',
    shortLabel: 'Manage branches',
    signupTitle: 'Register your salon business',
    signupSubtitle: 'Create an owner account to add branches, locations, and assign technicians.',
    submitLabel: 'Sign up as salon owner',
  },
}

export const parseSignupAccountType = (value) => {
  if (value === 'technician') return 'technician'
  if (value === 'salon_owner') return 'salon_owner'
  return 'client'
}
