const awsconfig = {
  Auth: {
    Cognito: {
      userPoolId: process.env.NEXT_PUBLIC_USER_POOL_ID,
      userPoolClientId: process.env.NEXT_PUBLIC_USER_POOL_CLIENT_ID,
      region: process.env.NEXT_PUBLIC_REGION || 'ap-northeast-1',
      signUpVerificationMethod: 'code',
      loginWith: {
        email: true,
      },
      passwordFormat: {
        requireLowercase: true,
        requireUppercase: true,
        requireNumbers: true,
        requireSpecialCharacters: true,
        minLength: 8,
      },
    }
  }
};

export default awsconfig;