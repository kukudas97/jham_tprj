import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AssetDetailDrawer from '../components/AssetDetailDrawer';

const QrScanPage: React.FC = () => {
  const { pid } = useParams<{ pid: string }>();
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  useEffect(() => {
    if (!token) {
      navigate(`/login?redirect=/qr/${pid}`, { replace: true });
    }
  }, [token, pid, navigate]);

  if (!token || !pid) return null;

  return (
    <AssetDetailDrawer
      pid={pid}
      onClose={() => navigate('/assets', { replace: true })}
    />
  );
};

export default QrScanPage;
