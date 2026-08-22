import type { CSSProperties } from 'vue';

export const styles: Record<string, CSSProperties> = {
	container: {
		padding: '24px',
		maxWidth: '360px',
		margin: '0 auto',
		display: 'flex',
		flexDirection: 'column',
	},
	title: { fontSize: '28px', fontWeight: 700, marginBottom: '24px' },
	body: { fontSize: '14px', color: '#666', marginBottom: '24px' },
	input: {
		border: '1px solid #ddd',
		borderRadius: '8px',
		padding: '12px',
		marginBottom: '12px',
		fontSize: '16px',
	},
	button: {
		backgroundColor: '#000',
		color: '#fff',
		padding: '14px',
		borderRadius: '8px',
		border: 'none',
		fontSize: '16px',
		fontWeight: 600,
		cursor: 'pointer',
		marginTop: '8px',
	},
	error: { color: '#e11d48', marginBottom: '12px', fontSize: '14px' },
	sent: { marginTop: '16px', textAlign: 'center', color: '#666', fontSize: '14px' },
	link: {
		marginTop: '16px',
		background: 'none',
		border: 'none',
		color: '#666',
		cursor: 'pointer',
		fontSize: '14px',
	},
};
