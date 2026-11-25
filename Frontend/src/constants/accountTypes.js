export const ACCOUNT_TYPES = {
  client: {
    value: 'client',
    label: 'Client',
    shortLabel: 'Book appointments',
    signupTitle: 'Create your account',
    signupSubtitle: 'Email or Google — about 20 seconds, then you can book.',
    submitLabel: 'Sign up as client',
  },
  technician: {
    value: 'technician',
    label: 'Technician',
    shortLabel: 'Studio team',
    signupTitle: 'Welcome to the studio',
    signupSubtitle:
      'Join a salon with a branch invite code, or apply as a freelancer for platform admin review.',
    submitLabel: 'Create technician account',
  },
  salon_owner: {
    value: 'salon_owner',
    label: 'Salon owner',
    shortLabel: 'Manage branches',
    signupTitle: 'Register your salon business',
    signupSubtitle: 'Email or Google, then add your first branch.',
    submitLabel: 'Sign up as salon owner',
  },
}

export const parseSignupAccountType = (value) => {
  if (value === 'technician') return 'technician'
  if (value === 'salon_owner') return 'salon_owner'
  return 'client'
}
