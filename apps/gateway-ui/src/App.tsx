import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Flex } from '@chakra-ui/react';
import { GatewayInfo, FederationInfo, GatewayBalances } from '@fedimint/types';
import { ConnectFederationModal, LightningCard } from './components';
import { GatewayApi } from './GatewayApi';
import { ApiProvider } from './ApiProvider';
import { Wrapper, Login } from '@fedimint/ui';
import { FederationsTable } from './components/federations/FederationsTable';
import { Loading } from './components/Loading';
import { HeaderWithUnitSelector } from './components/HeaderWithUnitSelector';
import { WalletCard } from './components/walletCard/WalletCard';
import {
  WalletModal,
  WalletModalAction,
  WalletModalState,
  WalletModalType,
} from './components/walletModal/WalletModal';
import { ErrorMessage } from './components/ErrorMessage';

export const UNIT_OPTIONS = ['msats', 'sats', 'btc'] as const;
export type Unit = (typeof UNIT_OPTIONS)[number];

export const App = React.memo(function Admin(): JSX.Element {
  const gateway = useRef(() => new GatewayApi());
  const [balances, setBalances] = useState<GatewayBalances | null>(null);

  const [gatewayInfo, setGatewayInfo] = useState<GatewayInfo>({
    federations: [],
    fees: {
      base_msat: 0,
      proportional_millionths: 0,
    },
    gateway_id: '',
    gateway_state: '',
    lightning_alias: '',
    lightning_pub_key: '',
    route_hints: [],
    version_hash: '',
    network: undefined,
  });

  // Whether the user has successfully authenticated with the gateway.
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  // Whether we are currently checking the authentication status.
  const [runningInitialAuthCheck, setRunningInitialAuthCheck] = useState(false);

  const [error, setError] = useState<string>('');
  const [showConnectFed, setShowConnectFed] = useState(false);
  const [unit, setUnit] = useState<Unit>('sats');
  const [walletModalState, setWalletModalState] = useState<WalletModalState>({
    isOpen: false,
    action: WalletModalAction.Receive,
    type: WalletModalType.Onchain,
    selectedFederation: null,
  });

  // Attempt to authenticate with the saved password on initial load and skip the login screen if successful.
  useEffect(() => {
    setRunningInitialAuthCheck(true);
    gateway
      .current()
      .testPassword()
      .then((authed) => {
        setIsAuthenticated(authed);
      })
      .catch((err) => {
        console.error(err);
      })
      .finally(() => setRunningInitialAuthCheck(false));
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      const fetchInfo = () => {
        gateway
          .current()
          .fetchInfo()
          .then((gatewayInfo) => {
            setGatewayInfo(gatewayInfo);
          })
          .catch(({ message, error }) => {
            console.error(error);
            setError(message);
          });
      };

      const fetchBalances = () => {
        gateway
          .current()
          .fetchBalances()
          .then((balances) => {
            setBalances(balances);
          })
          .catch(({ message, error }) => {
            console.error(error);
            setError(message);
          });
      };

      fetchInfo();
      fetchBalances();
      const interval = setInterval(fetchInfo, 5000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  const content = useMemo(() => {
    if (runningInitialAuthCheck) return <Loading />;
    if (error) return <ErrorMessage error={error} />;
    if (!isAuthenticated) {
      return (
        <Login
          checkAuth={gateway.current().testPassword}
          setAuthenticated={() => setIsAuthenticated(true)}
          parseError={(err) => (err as Error).message}
        />
      );
    }

    return (
      <Flex direction='column' gap={4}>
        <HeaderWithUnitSelector setUnit={setUnit} />
        {balances && (
          <WalletCard
            unit={unit}
            balances={balances}
            setWalletModalState={setWalletModalState}
            federations={gatewayInfo.federations}
          />
        )}
        <LightningCard
          nodeId={gatewayInfo.gateway_id}
          network={gatewayInfo.network}
        />
        <FederationsTable
          unit={unit}
          federations={gatewayInfo.federations}
          onConnectFederation={() => setShowConnectFed(true)}
          setWalletModalState={setWalletModalState}
        />
        <ConnectFederationModal
          isOpen={showConnectFed}
          onClose={() => setShowConnectFed(false)}
          renderConnectedFedCallback={(federation: FederationInfo) => {
            setGatewayInfo({
              ...gatewayInfo,
              federations: [...gatewayInfo.federations, federation],
            });
            setShowConnectFed(false);
          }}
        />
        <WalletModal
          federations={gatewayInfo.federations}
          walletModalState={walletModalState}
          setWalletModalState={setWalletModalState}
        />
      </Flex>
    );
  }, [
    runningInitialAuthCheck,
    isAuthenticated,
    showConnectFed,
    error,
    gatewayInfo,
    unit,
    walletModalState,
    balances,
  ]);

  return (
    <ApiProvider props={{ gateway: gateway.current() }}>
      <Wrapper size='lg'>{content}</Wrapper>
    </ApiProvider>
  );
});
